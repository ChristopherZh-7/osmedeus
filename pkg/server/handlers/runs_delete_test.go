package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ChristopherZh-7/golish-pentest-platform/v5/internal/database"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDeleteRunDeletesTerminalRecord(t *testing.T) {
	cfg, cleanup := setupAssetDiffTestDB(t)
	defer cleanup()

	run := &database.Run{
		RunUUID: "handler-delete-run", WorkflowName: "test-flow", WorkflowKind: "flow",
		Target: "example.com", Status: "completed", OrgUUID: database.DefaultOrgUUID,
	}
	require.NoError(t, database.CreateRun(t.Context(), run))

	app := fiber.New()
	app.Delete("/runs/:id/record", DeleteRun(cfg))
	response, err := app.Test(httptest.NewRequest(http.MethodDelete, "/runs/"+run.RunUUID+"/record", nil))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, response.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(response.Body).Decode(&body))
	assert.Equal(t, run.RunUUID, body["run_uuid"])
	_, err = database.GetRunByID(t.Context(), run.RunUUID, false, false)
	assert.Error(t, err)
}

func TestDeleteRunRejectsActiveRecord(t *testing.T) {
	cfg, cleanup := setupAssetDiffTestDB(t)
	defer cleanup()

	run := &database.Run{
		RunUUID: "handler-delete-active", WorkflowName: "test-flow", WorkflowKind: "flow",
		Target: "example.com", Status: "running", OrgUUID: database.DefaultOrgUUID,
	}
	require.NoError(t, database.CreateRun(t.Context(), run))

	app := fiber.New()
	app.Delete("/runs/:id/record", DeleteRun(cfg))
	response, err := app.Test(httptest.NewRequest(http.MethodDelete, "/runs/"+run.RunUUID+"/record", nil))
	require.NoError(t, err)
	assert.Equal(t, http.StatusConflict, response.StatusCode)
}

func TestDeleteRunReturnsNotFound(t *testing.T) {
	cfg, cleanup := setupAssetDiffTestDB(t)
	defer cleanup()

	app := fiber.New()
	app.Delete("/runs/:id/record", DeleteRun(cfg))
	response, err := app.Test(httptest.NewRequest(http.MethodDelete, "/runs/missing/record", nil))
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, response.StatusCode)
}
