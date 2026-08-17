package database

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDeleteRunRecordRemovesOwnedDatabaseRecords(t *testing.T) {
	cleanup := setupOrgTestDB(t)
	defer cleanup()

	ctx := context.Background()
	run := &Run{
		RunUUID: "run-delete-terminal", WorkflowName: "test-flow", WorkflowKind: "flow",
		Target: "example.com", Status: "completed", Workspace: "example.com",
		OrgUUID: DefaultOrgUUID,
	}
	require.NoError(t, CreateRun(ctx, run))

	step := &StepResult{
		ID: "step-delete", RunID: run.ID, RunUUID: run.RunUUID, StepName: "step",
		StepType: "bash", Status: "success", CreatedAt: time.Now(),
	}
	artifact := &Artifact{
		ID: "artifact-delete", RunID: run.ID, Workspace: run.Workspace, Name: "result",
		ArtifactPath: "/tmp/result.txt", CreatedAt: time.Now(),
	}
	agentSession := &AgentSession{RunID: run.ID, StepName: "agent", Status: "completed"}
	event := &EventLog{Topic: "run.completed", RunID: run.RunUUID}
	unrelatedEvent := &EventLog{Topic: "run.completed", RunID: "another-run"}
	for _, model := range []any{step, artifact, agentSession, event, unrelatedEvent} {
		_, err := db.NewInsert().Model(model).Exec(ctx)
		require.NoError(t, err)
	}

	deleted, err := DeleteRunRecord(ctx, run.RunUUID)
	require.NoError(t, err)
	assert.Equal(t, run.RunUUID, deleted.RunUUID)

	for table, condition := range map[string]string{
		"runs":           fmt.Sprintf("id = %d", run.ID),
		"step_results":   fmt.Sprintf("run_id = %d", run.ID),
		"artifacts":      fmt.Sprintf("run_id = %d", run.ID),
		"agent_sessions": fmt.Sprintf("run_id = %d", run.ID),
		"event_logs":     "run_id = 'run-delete-terminal'",
	} {
		count, countErr := db.NewSelect().Table(table).Where(condition).Count(ctx)
		require.NoError(t, countErr)
		assert.Zero(t, count, table)
	}

	unrelatedCount, err := db.NewSelect().Model((*EventLog)(nil)).
		Where("run_id = ?", unrelatedEvent.RunID).Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, unrelatedCount)
}

func TestDeleteRunRecordSupportsNumericID(t *testing.T) {
	cleanup := setupOrgTestDB(t)
	defer cleanup()

	run := &Run{
		RunUUID: "run-delete-by-id", WorkflowName: "test-flow", WorkflowKind: "flow",
		Target: "example.com", Status: "failed", OrgUUID: DefaultOrgUUID,
	}
	require.NoError(t, CreateRun(t.Context(), run))

	deleted, err := DeleteRunRecord(t.Context(), fmt.Sprint(run.ID))
	require.NoError(t, err)
	assert.Equal(t, run.RunUUID, deleted.RunUUID)
}

func TestDeleteRunRecordRejectsActiveRuns(t *testing.T) {
	cleanup := setupOrgTestDB(t)
	defer cleanup()

	for _, status := range []string{"pending", "running"} {
		run := &Run{
			RunUUID: "run-delete-" + status, WorkflowName: "test-flow", WorkflowKind: "flow",
			Target: "example.com", Status: status, OrgUUID: DefaultOrgUUID,
		}
		require.NoError(t, CreateRun(t.Context(), run))

		_, err := DeleteRunRecord(t.Context(), run.RunUUID)
		assert.ErrorIs(t, err, ErrRunActive)
		_, err = GetRunByID(t.Context(), run.RunUUID, false, false)
		assert.NoError(t, err)
	}
}

func TestDeleteRunRecordReturnsNotFound(t *testing.T) {
	cleanup := setupOrgTestDB(t)
	defer cleanup()

	_, err := DeleteRunRecord(t.Context(), "missing-run")
	assert.ErrorIs(t, err, ErrRunNotFound)
}
