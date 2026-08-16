package cli

import (
	"testing"

	"github.com/j3ssie/osmedeus/v5/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetAgentHarnessConfigValues(t *testing.T) {
	cfg := &config.Config{}

	require.NoError(t, setConfigValue(cfg, "agent_harness.enabled", "true"))
	require.NoError(t, setConfigValue(cfg, "agent_harness.provider", "deepseek-harness"))
	require.NoError(t, setConfigValue(cfg, "agent_harness.base_url", "http://agent-harness:3080"))
	require.NoError(t, setConfigValue(cfg, "agent_harness.request_timeout_seconds", "7"))

	assert.True(t, cfg.AgentHarness.Enabled)
	assert.Equal(t, "deepseek-harness", cfg.AgentHarness.Provider)
	assert.Equal(t, "http://agent-harness:3080", cfg.AgentHarness.BaseURL)
	assert.Equal(t, 7, cfg.AgentHarness.RequestTimeoutSeconds)
}

func TestSetAgentHarnessConfigRejectsInvalidValues(t *testing.T) {
	cfg := &config.Config{}

	require.Error(t, setConfigValue(cfg, "agent_harness.enabled", "sometimes"))
	require.Error(t, setConfigValue(cfg, "agent_harness.request_timeout_seconds", "0"))
	require.Error(t, setConfigValue(cfg, "agent_harness.unknown", "value"))
}
