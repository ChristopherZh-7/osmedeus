package database

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDeleteWorkspaceRecordsRemovesOwnedData(t *testing.T) {
	cleanup := setupOrgTestDB(t)
	defer cleanup()

	ctx := context.Background()
	now := time.Now()
	workspace := &Workspace{
		Name: "delete.example", OrgUUID: DefaultOrgUUID, LocalPath: "/tmp/delete.example",
		CreatedAt: now, UpdatedAt: now,
	}
	_, err := db.NewInsert().Model(workspace).Exec(ctx)
	require.NoError(t, err)

	run := &Run{
		RunUUID: "workspace-delete-run", WorkflowName: "test-flow", WorkflowKind: "flow",
		Target: workspace.Name, Workspace: workspace.Name, Status: "completed", OrgUUID: DefaultOrgUUID,
	}
	require.NoError(t, CreateRun(ctx, run))

	session := &PentestSession{
		UUID: "workspace-delete-session", OrgUUID: DefaultOrgUUID, WorkspaceID: workspace.ID,
		Workspace: workspace.Name, Title: "terminal session", Status: "ready",
	}
	task := &PentestTask{
		UUID: "workspace-delete-task", SessionUUID: session.UUID, Title: "done",
		Objective: "done", Status: PentestTaskCompleted,
	}
	memory := &PentestMemory{
		SessionUUID: session.UUID, TaskUUID: task.UUID, Kind: "finding", Content: "done",
		ContentHash: "workspace-delete-memory", SourceRole: "tester",
	}

	models := []any{
		&StepResult{ID: "workspace-delete-step", RunID: run.ID, RunUUID: run.RunUUID, StepName: "step", StepType: "bash", Status: "success"},
		&Artifact{ID: "workspace-delete-artifact", RunID: run.ID, Workspace: workspace.Name, Name: "artifact", ArtifactPath: "/tmp/delete.example/result.txt"},
		&AgentSession{RunID: run.ID, StepName: "agent", Status: "completed"},
		&EventLog{Topic: "run.completed", Workspace: workspace.Name, RunID: run.RunUUID},
		&Asset{Workspace: workspace.Name, OrgUUID: DefaultOrgUUID, AssetValue: "https://delete.example", CreatedAt: now, UpdatedAt: now},
		&Vulnerability{Workspace: workspace.Name, OrgUUID: DefaultOrgUUID, VulnTitle: "finding", Severity: "high", CreatedAt: now, UpdatedAt: now},
		&AssetDiffSnapshot{WorkspaceName: workspace.Name, FromTime: now.Add(-time.Hour), ToTime: now},
		&VulnDiffSnapshot{WorkspaceName: workspace.Name, FromTime: now.Add(-time.Hour), ToTime: now},
		session,
		task,
		&PentestSubtask{UUID: "workspace-delete-subtask", TaskUUID: task.UUID, Position: 1, Title: "done", Description: "done", Status: PentestSubtaskCompleted},
		&PentestRoleRun{UUID: "workspace-delete-role-run", TaskUUID: task.UUID, Role: "tester", Status: PentestRoleRunCompleted},
		&PentestPlanEvent{TaskUUID: task.UUID, Revision: 1},
		memory,
		&PentestCoverage{SessionUUID: session.UUID, OrgUUID: DefaultOrgUUID, Workspace: workspace.Name, AssetID: 1, AssetValue: workspace.Name, Surface: "http", Category: "test", Status: "completed"},
		&Schedule{ID: "workspace-delete-schedule", Name: "retained", WorkflowName: "test-flow", Workspace: workspace.Name, TriggerName: "manual", TriggerType: "manual"},
	}
	for _, model := range models {
		_, err := db.NewInsert().Model(model).Exec(ctx)
		require.NoError(t, err)
	}
	_, err = db.NewInsert().Model(&PentestMemoryEmbedding{
		MemoryID: memory.ID, Model: "test", ContentHash: memory.ContentHash, Dimensions: 1, Vector: []byte{1},
	}).Exec(ctx)
	require.NoError(t, err)

	result, err := DeleteWorkspaceRecords(ctx, workspace.Name)
	require.NoError(t, err)
	assert.Equal(t, workspace.ID, result.Workspace.ID)
	assert.EqualValues(t, 1, result.Deleted["workspaces"])
	assert.EqualValues(t, 1, result.Deleted["runs"])
	assert.EqualValues(t, 1, result.Deleted["assets"])

	checks := []struct {
		model any
		where string
		arg   any
	}{
		{model: (*Workspace)(nil), where: "name = ?", arg: workspace.Name},
		{model: (*Run)(nil), where: "workspace = ?", arg: workspace.Name},
		{model: (*StepResult)(nil), where: "run_id = ?", arg: run.ID},
		{model: (*Artifact)(nil), where: "workspace = ?", arg: workspace.Name},
		{model: (*AgentSession)(nil), where: "run_id = ?", arg: run.ID},
		{model: (*EventLog)(nil), where: "workspace = ?", arg: workspace.Name},
		{model: (*Asset)(nil), where: "workspace = ?", arg: workspace.Name},
		{model: (*Vulnerability)(nil), where: "workspace = ?", arg: workspace.Name},
		{model: (*AssetDiffSnapshot)(nil), where: "workspace_name = ?", arg: workspace.Name},
		{model: (*VulnDiffSnapshot)(nil), where: "workspace_name = ?", arg: workspace.Name},
		{model: (*PentestSession)(nil), where: "uuid = ?", arg: session.UUID},
		{model: (*PentestTask)(nil), where: "session_uuid = ?", arg: session.UUID},
		{model: (*PentestMemory)(nil), where: "session_uuid = ?", arg: session.UUID},
		{model: (*PentestMemoryEmbedding)(nil), where: "memory_id = ?", arg: memory.ID},
		{model: (*PentestCoverage)(nil), where: "session_uuid = ?", arg: session.UUID},
	}
	for _, check := range checks {
		count, countErr := db.NewSelect().Model(check.model).Where(check.where, check.arg).Count(ctx)
		require.NoError(t, countErr)
		assert.Zero(t, count, check.where)
	}

	retainedSchedules, err := db.NewSelect().Model((*Schedule)(nil)).Where("id = ?", "workspace-delete-schedule").Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, retainedSchedules)
}

func TestDeleteWorkspaceRecordsRejectsActiveWork(t *testing.T) {
	cleanup := setupOrgTestDB(t)
	defer cleanup()

	workspace := &Workspace{Name: "active.example", OrgUUID: DefaultOrgUUID}
	_, err := db.NewInsert().Model(workspace).Exec(t.Context())
	require.NoError(t, err)
	run := &Run{
		RunUUID: "workspace-active-run", WorkflowName: "test-flow", WorkflowKind: "flow",
		Target: workspace.Name, Workspace: workspace.Name, Status: "running", OrgUUID: DefaultOrgUUID,
	}
	require.NoError(t, CreateRun(t.Context(), run))

	_, err = DeleteWorkspaceRecords(t.Context(), workspace.Name)
	assert.ErrorIs(t, err, ErrWorkspaceActive)

	count, err := db.NewSelect().Model((*Workspace)(nil)).Where("name = ?", workspace.Name).Count(t.Context())
	require.NoError(t, err)
	assert.Equal(t, 1, count)
}

func TestDeleteWorkspaceRecordsSupportsAssetOnlyWorkspace(t *testing.T) {
	cleanup := setupOrgTestDB(t)
	defer cleanup()

	asset := &Asset{Workspace: "asset-only.example", OrgUUID: DefaultOrgUUID, AssetValue: "asset-only.example"}
	_, err := db.NewInsert().Model(asset).Exec(t.Context())
	require.NoError(t, err)

	result, err := DeleteWorkspaceRecords(t.Context(), asset.Workspace)
	require.NoError(t, err)
	assert.Zero(t, result.Workspace.ID)
	assert.EqualValues(t, 1, result.Deleted["assets"])

	_, err = DeleteWorkspaceRecords(t.Context(), "missing.example")
	assert.ErrorIs(t, err, ErrWorkspaceNotFound)
}
