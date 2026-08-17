package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/uptrace/bun"
)

var (
	// ErrWorkspaceNotFound is returned when neither a workspace record nor any
	// workspace-owned database data exists for the supplied name.
	ErrWorkspaceNotFound = errors.New("workspace not found")
	// ErrWorkspaceActive prevents deleting data while a scan or Agent Pentest
	// task can still be writing into the workspace.
	ErrWorkspaceActive = errors.New("active workspace cannot be deleted")
)

// WorkspaceDeleteResult describes the database portion of a workspace purge.
// Filesystem cleanup is performed by the API layer because it owns the resolved
// workspaces root and its path-safety checks.
type WorkspaceDeleteResult struct {
	Workspace Workspace        `json:"workspace"`
	Deleted   map[string]int64 `json:"deleted"`
}

// DeleteWorkspaceRecords permanently removes the database data owned by one
// workspace. Schedule definitions are intentionally retained: they are user
// configuration and may recreate the workspace on their next run.
func DeleteWorkspaceRecords(ctx context.Context, name string) (*WorkspaceDeleteResult, error) {
	if db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("%w: empty name", ErrWorkspaceNotFound)
	}

	result := &WorkspaceDeleteResult{
		Workspace: Workspace{Name: name},
		Deleted:   make(map[string]int64),
	}

	err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		workspaceFound := true
		if err := tx.NewSelect().Model(&result.Workspace).
			Where("name = ?", name).
			Scan(ctx); err != nil {
			if !errors.Is(err, sql.ErrNoRows) {
				return fmt.Errorf("failed to load workspace %q: %w", name, err)
			}
			workspaceFound = false
			result.Workspace = Workspace{Name: name}
		}

		activeRuns, err := tx.NewSelect().Model((*Run)(nil)).
			Where("workspace = ?", name).
			Where("status IN (?)", bun.In([]string{"pending", "running"})).
			Count(ctx)
		if err != nil {
			return fmt.Errorf("failed to check active runs for workspace %q: %w", name, err)
		}
		if activeRuns > 0 {
			return fmt.Errorf("%w: %d active run(s)", ErrWorkspaceActive, activeRuns)
		}

		var sessionUUIDs []string
		if err := tx.NewSelect().Model((*PentestSession)(nil)).
			Column("uuid").
			Where("workspace = ?", name).
			Scan(ctx, &sessionUUIDs); err != nil {
			return fmt.Errorf("failed to load Agent Pentest sessions for workspace %q: %w", name, err)
		}
		if len(sessionUUIDs) > 0 {
			activeTasks, err := tx.NewSelect().Model((*PentestTask)(nil)).
				Where("session_uuid IN (?)", bun.In(sessionUUIDs)).
				Where("status IN (?)", bun.In([]string{
					PentestTaskPlanning,
					PentestTaskRunning,
					PentestTaskWaitingInput,
				})).
				Count(ctx)
			if err != nil {
				return fmt.Errorf("failed to check active Agent Pentest tasks for workspace %q: %w", name, err)
			}
			if activeTasks > 0 {
				return fmt.Errorf("%w: %d active Agent Pentest task(s)", ErrWorkspaceActive, activeTasks)
			}
		}

		var runs []Run
		if err := tx.NewSelect().Model(&runs).
			Column("id", "run_uuid").
			Where("workspace = ?", name).
			Scan(ctx); err != nil {
			return fmt.Errorf("failed to load runs for workspace %q: %w", name, err)
		}
		runIDs := make([]int64, 0, len(runs))
		runUUIDs := make([]string, 0, len(runs))
		for i := range runs {
			runIDs = append(runIDs, runs[i].ID)
			if runs[i].RunUUID != "" {
				runUUIDs = append(runUUIDs, runs[i].RunUUID)
			}
		}

		var taskUUIDs []string
		var memoryIDs []int64
		if len(sessionUUIDs) > 0 {
			if err := tx.NewSelect().Model((*PentestTask)(nil)).
				Column("uuid").
				Where("session_uuid IN (?)", bun.In(sessionUUIDs)).
				Scan(ctx, &taskUUIDs); err != nil {
				return fmt.Errorf("failed to load Agent Pentest tasks for workspace %q: %w", name, err)
			}
			if err := tx.NewSelect().Model((*PentestMemory)(nil)).
				Column("id").
				Where("session_uuid IN (?)", bun.In(sessionUUIDs)).
				Scan(ctx, &memoryIDs); err != nil {
				return fmt.Errorf("failed to load Agent Pentest memory for workspace %q: %w", name, err)
			}
		}

		deleteRows := func(key string, query *bun.DeleteQuery) error {
			res, err := query.Exec(ctx)
			if err != nil {
				return fmt.Errorf("failed to delete %s for workspace %q: %w", key, name, err)
			}
			if count, err := res.RowsAffected(); err == nil {
				result.Deleted[key] += count
			}
			return nil
		}

		if len(memoryIDs) > 0 {
			if err := deleteRows("agent_pentest_memory_embeddings",
				tx.NewDelete().Model((*PentestMemoryEmbedding)(nil)).Where("memory_id IN (?)", bun.In(memoryIDs))); err != nil {
				return err
			}
		}
		if len(taskUUIDs) > 0 {
			for _, deletion := range []struct {
				key   string
				model any
			}{
				{key: "agent_pentest_plan_events", model: (*PentestPlanEvent)(nil)},
				{key: "agent_pentest_role_runs", model: (*PentestRoleRun)(nil)},
				{key: "agent_pentest_subtasks", model: (*PentestSubtask)(nil)},
			} {
				if err := deleteRows(deletion.key,
					tx.NewDelete().Model(deletion.model).Where("task_uuid IN (?)", bun.In(taskUUIDs))); err != nil {
					return err
				}
			}
		}
		if len(sessionUUIDs) > 0 {
			for _, deletion := range []struct {
				key   string
				model any
			}{
				{key: "agent_pentest_memory", model: (*PentestMemory)(nil)},
				{key: "agent_pentest_tasks", model: (*PentestTask)(nil)},
				{key: "agent_pentest_coverage", model: (*PentestCoverage)(nil)},
			} {
				if err := deleteRows(deletion.key,
					tx.NewDelete().Model(deletion.model).Where("session_uuid IN (?)", bun.In(sessionUUIDs))); err != nil {
					return err
				}
			}
			if err := deleteRows("agent_pentest_sessions",
				tx.NewDelete().Model((*PentestSession)(nil)).Where("uuid IN (?)", bun.In(sessionUUIDs))); err != nil {
				return err
			}
		}

		if len(runIDs) > 0 {
			for _, deletion := range []struct {
				key   string
				model any
			}{
				{key: "agent_sessions", model: (*AgentSession)(nil)},
				{key: "step_results", model: (*StepResult)(nil)},
			} {
				if err := deleteRows(deletion.key,
					tx.NewDelete().Model(deletion.model).Where("run_id IN (?)", bun.In(runIDs))); err != nil {
					return err
				}
			}
		}

		artifactQuery := tx.NewDelete().Model((*Artifact)(nil)).Where("workspace = ?", name)
		if len(runIDs) > 0 {
			artifactQuery = artifactQuery.WhereOr("run_id IN (?)", bun.In(runIDs))
		}
		if err := deleteRows("artifacts", artifactQuery); err != nil {
			return err
		}

		eventQuery := tx.NewDelete().Model((*EventLog)(nil)).Where("workspace = ?", name)
		if len(runUUIDs) > 0 {
			eventQuery = eventQuery.WhereOr("run_id IN (?)", bun.In(runUUIDs))
		}
		if err := deleteRows("event_logs", eventQuery); err != nil {
			return err
		}

		for _, deletion := range []struct {
			key    string
			model  any
			column string
		}{
			{key: "assets", model: (*Asset)(nil), column: "workspace"},
			{key: "vulnerabilities", model: (*Vulnerability)(nil), column: "workspace"},
			{key: "asset_diffs", model: (*AssetDiffSnapshot)(nil), column: "workspace_name"},
			{key: "vuln_diffs", model: (*VulnDiffSnapshot)(nil), column: "workspace_name"},
			{key: "runs", model: (*Run)(nil), column: "workspace"},
			{key: "workspaces", model: (*Workspace)(nil), column: "name"},
		} {
			if err := deleteRows(deletion.key,
				tx.NewDelete().Model(deletion.model).Where(deletion.column+" = ?", name)); err != nil {
				return err
			}
		}

		deletedAnything := workspaceFound
		if !deletedAnything {
			for _, count := range result.Deleted {
				if count > 0 {
					deletedAnything = true
					break
				}
			}
		}
		if !deletedAnything {
			return fmt.Errorf("%w: %s", ErrWorkspaceNotFound, name)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	if cache := GetCache(); cache != nil {
		cache.InvalidateWorkspace(name)
	}
	invalidateWorkspaceOrgCache()
	return result, nil
}
