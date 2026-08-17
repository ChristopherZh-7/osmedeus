package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/uptrace/bun"
)

var (
	// ErrRunNotFound is returned when a run identifier resolves to no record.
	ErrRunNotFound = errors.New("run not found")
	// ErrRunActive is returned when a caller tries to delete a run that may
	// still have queued or executing work.
	ErrRunActive = errors.New("active run cannot be deleted")
)

// DeleteRunRecord removes a terminal run and the database records owned by it.
// Workspace files and independently imported assets or vulnerabilities are
// intentionally retained.
func DeleteRunRecord(ctx context.Context, id string) (*Run, error) {
	if db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	id = strings.TrimSpace(id)
	if id == "" {
		return nil, fmt.Errorf("%w: empty identifier", ErrRunNotFound)
	}

	var deleted Run
	err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		query := tx.NewSelect().Model(&deleted).Where("run_uuid = ?", id)
		if numericID, err := strconv.ParseInt(id, 10, 64); err == nil {
			query = query.WhereOr("id = ?", numericID)
		}
		if err := query.Scan(ctx); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return fmt.Errorf("%w: %s", ErrRunNotFound, id)
			}
			return fmt.Errorf("failed to load run %s: %w", id, err)
		}

		if deleted.Status == "pending" || deleted.Status == "running" {
			return fmt.Errorf("%w: status %q", ErrRunActive, deleted.Status)
		}

		for _, deletion := range []struct {
			model any
			where string
			value any
		}{
			{model: (*AgentSession)(nil), where: "run_id = ?", value: deleted.ID},
			{model: (*Artifact)(nil), where: "run_id = ?", value: deleted.ID},
			{model: (*StepResult)(nil), where: "run_id = ?", value: deleted.ID},
			{model: (*EventLog)(nil), where: "run_id = ?", value: deleted.RunUUID},
		} {
			if _, err := tx.NewDelete().Model(deletion.model).
				Where(deletion.where, deletion.value).
				Exec(ctx); err != nil {
				return fmt.Errorf("failed to delete records associated with run %s: %w", deleted.RunUUID, err)
			}
		}

		result, err := tx.NewDelete().Model((*Run)(nil)).
			Where("id = ?", deleted.ID).
			Where("status NOT IN (?)", bun.In([]string{"pending", "running"})).
			Exec(ctx)
		if err != nil {
			return fmt.Errorf("failed to delete run %s: %w", deleted.RunUUID, err)
		}
		if affected, _ := result.RowsAffected(); affected == 0 {
			return fmt.Errorf("%w: status changed while deleting", ErrRunActive)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &deleted, nil
}
