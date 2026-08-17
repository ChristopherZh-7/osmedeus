package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/ChristopherZh-7/golish-pentest-platform/v5/internal/config"
	"github.com/ChristopherZh-7/golish-pentest-platform/v5/internal/database"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupWorkspaceDeleteTest(t *testing.T) (*config.Config, *fiber.App) {
	t.Helper()
	tmpDir := t.TempDir()
	workspacesDir := filepath.Join(tmpDir, "workspaces")
	require.NoError(t, os.MkdirAll(workspacesDir, 0o755))
	cfg := &config.Config{
		BaseFolder:     tmpDir,
		WorkspacesPath: workspacesDir,
		Database: config.DatabaseConfig{
			DBEngine: "sqlite",
			DBPath:   filepath.Join(tmpDir, "workspaces.sqlite"),
		},
	}

	_, err := database.Connect(cfg)
	require.NoError(t, err)
	require.NoError(t, database.Migrate(t.Context()))
	t.Cleanup(func() {
		_ = database.Close()
		database.SetDB(nil)
	})

	app := fiber.New()
	app.Delete("/workspaces/:name", DeleteWorkspace(cfg))
	return cfg, app
}

func TestDeleteWorkspaceRemovesDatabaseDataAndDirectory(t *testing.T) {
	cfg, app := setupWorkspaceDeleteTest(t)
	name := "delete.example"
	workspacePath := filepath.Join(cfg.WorkspacesPath, name)
	require.NoError(t, os.MkdirAll(workspacePath, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(workspacePath, "result.txt"), []byte("result"), 0o600))

	workspace := &database.Workspace{Name: name, OrgUUID: database.DefaultOrgUUID, LocalPath: workspacePath}
	_, err := database.GetDB().NewInsert().Model(workspace).Exec(t.Context())
	require.NoError(t, err)
	_, err = database.GetDB().NewInsert().Model(&database.Asset{
		Workspace: name, OrgUUID: database.DefaultOrgUUID, AssetValue: "https://delete.example",
	}).Exec(t.Context())
	require.NoError(t, err)

	response, err := app.Test(httptest.NewRequest(http.MethodDelete, "/workspaces/"+name, nil))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, response.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(response.Body).Decode(&body))
	assert.Equal(t, name, body["name"])
	assert.Equal(t, true, body["files_deleted"])
	_, err = os.Lstat(workspacePath)
	assert.True(t, os.IsNotExist(err))

	count, err := database.GetDB().NewSelect().Model((*database.Workspace)(nil)).Where("name = ?", name).Count(t.Context())
	require.NoError(t, err)
	assert.Zero(t, count)
	count, err = database.GetDB().NewSelect().Model((*database.Asset)(nil)).Where("workspace = ?", name).Count(t.Context())
	require.NoError(t, err)
	assert.Zero(t, count)
}

func TestDeleteWorkspaceRejectsActiveRunAndKeepsDirectory(t *testing.T) {
	cfg, app := setupWorkspaceDeleteTest(t)
	name := "active.example"
	workspacePath := filepath.Join(cfg.WorkspacesPath, name)
	require.NoError(t, os.MkdirAll(workspacePath, 0o755))

	workspace := &database.Workspace{Name: name, OrgUUID: database.DefaultOrgUUID, LocalPath: workspacePath}
	_, err := database.GetDB().NewInsert().Model(workspace).Exec(t.Context())
	require.NoError(t, err)
	require.NoError(t, database.CreateRun(t.Context(), &database.Run{
		RunUUID: "active-workspace-handler", WorkflowName: "test-flow", WorkflowKind: "flow",
		Target: name, Workspace: name, Status: "running", OrgUUID: database.DefaultOrgUUID,
	}))

	response, err := app.Test(httptest.NewRequest(http.MethodDelete, "/workspaces/"+name, nil))
	require.NoError(t, err)
	assert.Equal(t, http.StatusConflict, response.StatusCode)
	_, err = os.Stat(workspacePath)
	assert.NoError(t, err)
}

func TestDeleteWorkspaceSupportsFilesystemOnlyWorkspace(t *testing.T) {
	cfg, app := setupWorkspaceDeleteTest(t)
	workspacePath := filepath.Join(cfg.WorkspacesPath, "filesystem-only")
	require.NoError(t, os.MkdirAll(workspacePath, 0o755))

	response, err := app.Test(httptest.NewRequest(http.MethodDelete, "/workspaces/filesystem-only", nil))
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, response.StatusCode)
	_, err = os.Stat(workspacePath)
	assert.True(t, os.IsNotExist(err))

	response, err = app.Test(httptest.NewRequest(http.MethodDelete, "/workspaces/missing", nil))
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, response.StatusCode)
}
