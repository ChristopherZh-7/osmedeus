package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/j3ssie/osmedeus/v5/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupSettingsSkillsTest(t *testing.T) (*config.Config, *fiber.App) {
	t.Helper()
	cfg := &config.Config{BaseFolder: t.TempDir()}
	app := fiber.New()
	app.Get("/settings/skills", ListSettingsSkills(cfg))
	app.Get("/settings/skills/:slug", GetSettingsSkill(cfg))
	app.Post("/settings/skills", CreateSettingsSkill(cfg))
	app.Put("/settings/skills/:slug", UpdateSettingsSkill(cfg))
	app.Delete("/settings/skills/:slug", DeleteSettingsSkill(cfg))
	return cfg, app
}

func settingsSkillJSONRequest(t *testing.T, method, path string, payload any) *http.Request {
	t.Helper()
	encoded, err := json.Marshal(payload)
	require.NoError(t, err)
	req := httptest.NewRequest(method, path, bytes.NewReader(encoded))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	return req
}

func responseBody(t *testing.T, response *http.Response) []byte {
	t.Helper()
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	return body
}

func TestSettingsSkillCRUD(t *testing.T) {
	cfg, app := setupSettingsSkillsTest(t)
	content := "---\nname: custom-recon\ndescription: Custom reconnaissance guidance\n---\n\n# Custom Recon\n"

	response, err := app.Test(settingsSkillJSONRequest(t, http.MethodPost, "/settings/skills", fiber.Map{
		"slug": "custom-recon", "content": content,
	}))
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, response.StatusCode, string(responseBody(t, response)))

	skillPath := filepath.Join(cfg.BaseFolder, "agent-harness", "dsh-home", "skills", "custom-recon", "SKILL.md")
	stored, err := os.ReadFile(skillPath)
	require.NoError(t, err)
	assert.Equal(t, content, string(stored))

	response, err = app.Test(httptest.NewRequest(http.MethodGet, "/settings/skills", nil))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, response.StatusCode)
	var listed struct {
		Pentest []settingsSkillView `json:"pentest"`
	}
	require.NoError(t, json.NewDecoder(response.Body).Decode(&listed))
	_ = response.Body.Close()
	require.Len(t, listed.Pentest, 1)
	assert.Equal(t, "custom-recon", listed.Pentest[0].Slug)
	assert.True(t, listed.Pentest[0].Editable)

	response, err = app.Test(settingsSkillJSONRequest(t, http.MethodPost, "/settings/skills", fiber.Map{
		"slug": "custom-recon", "content": content,
	}))
	require.NoError(t, err)
	assert.Equal(t, http.StatusConflict, response.StatusCode)
	_ = response.Body.Close()

	response, err = app.Test(httptest.NewRequest(http.MethodGet, "/settings/skills/custom-recon", nil))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, response.StatusCode)
	var detail settingsSkillDetail
	require.NoError(t, json.NewDecoder(response.Body).Decode(&detail))
	_ = response.Body.Close()
	assert.Equal(t, "custom-recon", detail.Slug)
	assert.Equal(t, "Custom reconnaissance guidance", detail.Description)
	assert.Equal(t, content, detail.Content)
	assert.True(t, detail.Editable)

	updated := "---\nname: custom-recon\ndescription: Updated guidance\n---\n\n# Updated\n"
	response, err = app.Test(settingsSkillJSONRequest(t, http.MethodPut, "/settings/skills/custom-recon", fiber.Map{"content": updated}))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, response.StatusCode, string(responseBody(t, response)))
	stored, err = os.ReadFile(skillPath)
	require.NoError(t, err)
	assert.Equal(t, updated, string(stored))

	response, err = app.Test(httptest.NewRequest(http.MethodDelete, "/settings/skills/custom-recon", nil))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, response.StatusCode)
	_ = response.Body.Close()
	_, err = os.Lstat(filepath.Dir(skillPath))
	assert.True(t, os.IsNotExist(err))

	response, err = app.Test(httptest.NewRequest(http.MethodGet, "/settings/skills/custom-recon", nil))
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, response.StatusCode)
	_ = response.Body.Close()
}

func TestSettingsSkillValidation(t *testing.T) {
	_, app := setupSettingsSkillsTest(t)
	tests := []struct {
		name    string
		slug    string
		content string
	}{
		{name: "path traversal", slug: "..", content: "---\nname: ..\ndescription: invalid\n---\n"},
		{name: "uppercase slug", slug: "Bad-Skill", content: "---\nname: Bad-Skill\ndescription: invalid\n---\n"},
		{name: "missing frontmatter", slug: "missing-frontmatter", content: "# Skill\n"},
		{name: "missing description", slug: "missing-description", content: "---\nname: missing-description\n---\n"},
		{name: "name mismatch", slug: "expected-name", content: "---\nname: another-name\ndescription: mismatch\n---\n"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response, err := app.Test(settingsSkillJSONRequest(t, http.MethodPost, "/settings/skills", fiber.Map{
				"slug": test.slug, "content": test.content,
			}))
			require.NoError(t, err)
			assert.Equal(t, http.StatusBadRequest, response.StatusCode, string(responseBody(t, response)))
		})
	}
}

func TestSettingsSkillRejectsSymlinkDirectory(t *testing.T) {
	cfg, app := setupSettingsSkillsTest(t)
	root := filepath.Join(cfg.BaseFolder, "agent-harness", "dsh-home", "skills")
	require.NoError(t, os.MkdirAll(root, 0o755))
	target := t.TempDir()
	if err := os.Symlink(target, filepath.Join(root, "linked-skill")); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}

	response, err := app.Test(httptest.NewRequest(http.MethodDelete, "/settings/skills/linked-skill", nil))
	require.NoError(t, err)
	assert.Equal(t, http.StatusInternalServerError, response.StatusCode)
	_ = response.Body.Close()
	_, err = os.Stat(target)
	assert.NoError(t, err)
}
