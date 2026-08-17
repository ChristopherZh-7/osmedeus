package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/j3ssie/osmedeus/v5/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateIntegrationSettingsWriteOnlyAndPreserve(t *testing.T) {
	tmp := t.TempDir()
	cfg := config.DefaultConfig()
	cfg.BaseFolder = tmp
	cfg.ResolvePaths()
	raw, err := cfg.ToYAML()
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(tmp, "osm-settings.yaml"), raw, 0600))

	app := fiber.New()
	app.Put("/settings/integrations", UpdateIntegrationSettings(cfg, nil))
	app.Get("/settings/product", GetProductSettings(cfg, nil))

	payload := map[string]interface{}{"providers": []map[string]interface{}{
		{"id": "fofa", "api_key": "fofa-secret", "email": "operator@example.com"},
		{"id": "quake", "api_key": "quake-secret"},
		{"id": "hunter", "api_key": "hunter-secret"},
		{"id": "zerozone", "api_key": "zero-secret"},
	}}
	response := requestJSON(t, app, "PUT", "/settings/integrations", payload, fiber.StatusOK)
	encoded, err := json.Marshal(response)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "fofa-secret", "secrets must never be returned")

	stored, err := config.LoadFromFile(filepath.Join(tmp, "osm-settings.yaml"))
	require.NoError(t, err)
	assert.Equal(t, "fofa-secret", stored.GlobalVars["FOFA_API_KEY"].Value)
	assert.Equal(t, "operator@example.com", stored.GlobalVars["FOFA_EMAIL"].Value)
	assert.False(t, stored.GlobalVars["FOFA_API_KEY"].IsAsEnv(), "provider credentials should not be exported into workflow processes")

	preserve := map[string]interface{}{"providers": []map[string]interface{}{
		{"id": "fofa", "keep_api_key": true, "keep_email": true},
		{"id": "quake", "keep_api_key": true},
		{"id": "hunter", "keep_api_key": true},
		{"id": "zerozone", "keep_api_key": true},
	}}
	requestJSON(t, app, "PUT", "/settings/integrations", preserve, fiber.StatusOK)
	stored, err = config.LoadFromFile(filepath.Join(tmp, "osm-settings.yaml"))
	require.NoError(t, err)
	assert.Equal(t, "fofa-secret", stored.GlobalVars["FOFA_API_KEY"].Value)
	assert.Equal(t, "operator@example.com", stored.GlobalVars["FOFA_EMAIL"].Value)

	req := httptest.NewRequest("GET", "/settings/product", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	productRaw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	assert.NotContains(t, string(productRaw), "fofa-secret")
	assert.Contains(t, string(productRaw), `"id":"fofa"`)
	assert.Contains(t, string(productRaw), `"configured":true`)

	settingsFile, err := os.ReadFile(filepath.Join(tmp, "osm-settings.yaml"))
	require.NoError(t, err)
	assert.True(t, strings.Contains(string(settingsFile), "FOFA_API_KEY"))
}

func TestUpdateIntegrationSettingsFollowsDeploymentSymlink(t *testing.T) {
	tmp := t.TempDir()
	baseDir := filepath.Join(tmp, "base")
	configDir := filepath.Join(tmp, "config")
	require.NoError(t, os.MkdirAll(baseDir, 0700))
	require.NoError(t, os.MkdirAll(configDir, 0700))
	cfg := config.DefaultConfig()
	cfg.BaseFolder = baseDir
	cfg.ResolvePaths()
	raw, err := cfg.ToYAML()
	require.NoError(t, err)
	target := filepath.Join(configDir, "osm-settings.yaml")
	require.NoError(t, os.WriteFile(target, raw, 0600))
	link := filepath.Join(baseDir, "osm-settings.yaml")
	require.NoError(t, os.Symlink(target, link))

	app := fiber.New()
	app.Put("/settings/integrations", UpdateIntegrationSettings(cfg, nil))
	payload := map[string]interface{}{"providers": []map[string]interface{}{
		{"id": "fofa", "api_key": "symlink-secret", "email": "operator@example.com"},
		{"id": "quake"}, {"id": "hunter"}, {"id": "zerozone"},
	}}
	requestJSON(t, app, "PUT", "/settings/integrations", payload, fiber.StatusOK)

	info, err := os.Lstat(link)
	require.NoError(t, err)
	assert.NotZero(t, info.Mode()&os.ModeSymlink, "atomic update must not replace the deployment symlink")
	stored, err := config.LoadFromFile(target)
	require.NoError(t, err)
	assert.Equal(t, "symlink-secret", stored.GlobalVars["FOFA_API_KEY"].Value)
}

func TestProductSettingsExpandsEnvironmentBaseFolder(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("OSMEDEUS_SETTINGS_TEST_BASE", tmp)
	cfg := config.DefaultConfig()
	cfg.BaseFolder = "$OSMEDEUS_SETTINGS_TEST_BASE"
	raw, err := cfg.ToYAML()
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(tmp, "osm-settings.yaml"), raw, 0600))

	app := fiber.New()
	app.Get("/settings/product", GetProductSettings(cfg, nil))
	req := httptest.NewRequest("GET", "/settings/product", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode, string(body))
	assert.Contains(t, string(body), `"id":"fofa"`)
}

func TestSettingsSkillsReturnsEmptyArrays(t *testing.T) {
	cfg := config.DefaultConfig()
	cfg.BaseFolder = t.TempDir()
	app := fiber.New()
	app.Get("/settings/skills", ListSettingsSkills(cfg))
	req := httptest.NewRequest("GET", "/settings/skills", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	var payload map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&payload))
	assert.IsType(t, []interface{}{}, payload["pentest"])
}

func requestJSON(t *testing.T, app *fiber.App, method, path string, payload interface{}, status int) map[string]interface{} {
	t.Helper()
	raw, err := json.Marshal(payload)
	require.NoError(t, err)
	req := httptest.NewRequest(method, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, status, resp.StatusCode, string(body))
	result := map[string]interface{}{}
	require.NoError(t, json.Unmarshal(body, &result))
	return result
}
