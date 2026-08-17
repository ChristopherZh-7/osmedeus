package docker_test

import (
	"os"
	"strings"
	"testing"

	"github.com/j3ssie/osmedeus/v5/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProductionSettingsTemplateMatchesCurrentConfig(t *testing.T) {
	data, err := os.ReadFile("osm-settings.production.yaml")
	require.NoError(t, err)

	content := string(data)
	for token, value := range map[string]string{
		"__POSTGRES_PASSWORD__":    "postgres-test-password",
		"__OSM_ADMIN_PASSWORD__":   "admin-test-password",
		"__OSM_JWT_SECRET__":       strings.Repeat("a", 64),
		"__OSM_API_KEY__":          strings.Repeat("b", 48),
		"__WORKSPACE_PREFIX_KEY__": strings.Repeat("c", 16),
	} {
		content = strings.ReplaceAll(content, token, value)
	}

	cfg, err := config.ParseConfigStrict([]byte(content))
	require.NoError(t, err)
	require.NoError(t, cfg.Validate())
	cfg.ResolvePaths()

	assert.Equal(t, "postgresql", cfg.Database.DBEngine)
	assert.Equal(t, "postgres", cfg.Database.Host)
	assert.Equal(t, "/root/osmedeus-base/workflows", cfg.WorkflowsPath)
	assert.Equal(t, "http://agent-harness:3080", cfg.AgentHarness.GetBaseURL())
	assert.Empty(t, cfg.AgentHarness.GetPublicURL())
}
