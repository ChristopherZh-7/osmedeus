package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/j3ssie/osmedeus/v5/internal/config"
	"github.com/j3ssie/osmedeus/v5/internal/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompanyAPIClosedLoop(t *testing.T) {
	tmp := t.TempDir()
	cfg := &config.Config{
		BaseFolder:     tmp,
		WorkspacesPath: filepath.Join(tmp, "workspaces"),
		Database:       config.DatabaseConfig{DBEngine: "sqlite", DBPath: filepath.Join(tmp, "companies.sqlite")},
	}
	_, err := database.Connect(cfg)
	require.NoError(t, err)
	t.Cleanup(func() { _ = database.Close(); database.SetDB(nil) })
	require.NoError(t, database.Migrate(context.Background()))

	app := fiber.New()
	app.Post("/companies/intake", IntakeCompany(cfg))
	app.Post("/companies/:uuid/discover", DiscoverCompany(cfg))
	app.Post("/companies/:uuid/confirm", ConfirmCompany(cfg))

	intake := postJSON(t, app, "/companies/intake", map[string]interface{}{
		"name": "艾克米", "canonical_name": "艾克米科技有限公司", "official_website": "https://www.acme.com/about", "domains": []string{"acme.cn"},
	}, fiber.StatusCreated)
	data := intake["data"].(map[string]interface{})
	profile := data["profile"].(map[string]interface{})
	uuid := profile["uuid"].(string)
	assert.Empty(t, profile["org_uuid"])
	assert.Equal(t, "draft", profile["verification_status"])
	orgs, err := database.ListOrgs(context.Background())
	require.NoError(t, err)
	require.Len(t, orgs, 1)

	discovered := postJSON(t, app, "/companies/"+uuid+"/discover", nil, fiber.StatusOK)
	reports := discovered["providers"].([]interface{})
	require.Len(t, reports, 4)
	for _, item := range reports {
		assert.False(t, item.(map[string]interface{})["configured"].(bool))
	}

	confirmed := postJSON(t, app, "/companies/"+uuid+"/confirm", map[string]interface{}{
		"canonical_name": "艾克米科技有限公司", "domains": []string{"acme.com", "acme.cn"},
	}, fiber.StatusOK)
	confirmedData := confirmed["data"].(map[string]interface{})
	confirmedProfile := confirmedData["profile"].(map[string]interface{})
	assert.Equal(t, "confirmed", confirmedProfile["verification_status"])
	assert.NotEmpty(t, confirmedProfile["org_uuid"])
	assert.Equal(t, false, confirmed["scan_started"])
	created := confirmed["created"].(map[string]interface{})
	assert.Len(t, created["workspaces"].([]interface{}), 2)

	workspaceCount, err := database.GetDB().NewSelect().Model((*database.Workspace)(nil)).Where("org_uuid = ?", confirmedProfile["org_uuid"]).Count(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 2, workspaceCount)
	assetCount, err := database.GetDB().NewSelect().Model((*database.Asset)(nil)).Where("org_uuid = ?", confirmedProfile["org_uuid"]).Count(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 2, assetCount)
}

func TestLooksLikeLegalCompanyName(t *testing.T) {
	assert.True(t, looksLikeLegalCompanyName("北京艾克米科技有限公司"))
	assert.True(t, looksLikeLegalCompanyName("Acme Technology Co., Ltd."))
	assert.False(t, looksLikeLegalCompanyName("艾克米"))
	assert.False(t, looksLikeLegalCompanyName("Acme"))
}

func postJSON(t *testing.T, app *fiber.App, path string, payload interface{}, wantStatus int) map[string]interface{} {
	t.Helper()
	var body []byte
	var err error
	if payload != nil {
		body, err = json.Marshal(payload)
		require.NoError(t, err)
	}
	req := httptest.NewRequest("POST", path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, wantStatus, resp.StatusCode, string(raw))
	result := map[string]interface{}{}
	require.NoError(t, json.Unmarshal(raw, &result))
	return result
}
