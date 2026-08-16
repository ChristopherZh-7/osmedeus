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
	require.NoError(t, setConfigValue(cfg, "agent_harness.workspace_mount_path", "/osmedeus/workspaces"))
	require.NoError(t, setConfigValue(cfg, "agent_harness.request_timeout_seconds", "7"))
	require.NoError(t, setConfigValue(cfg, "agent_harness.rag_enabled", "true"))
	require.NoError(t, setConfigValue(cfg, "agent_harness.rag_embedding_url", "http://ollama:11434/v1/embeddings"))
	require.NoError(t, setConfigValue(cfg, "agent_harness.rag_embedding_model", "test-embedding"))
	require.NoError(t, setConfigValue(cfg, "agent_harness.rag_embedding_auth_token", "token"))
	require.NoError(t, setConfigValue(cfg, "agent_harness.rag_timeout_seconds", "13"))
	require.NoError(t, setConfigValue(cfg, "agent_harness.rag_candidate_limit", "250"))

	assert.True(t, cfg.AgentHarness.Enabled)
	assert.Equal(t, "deepseek-harness", cfg.AgentHarness.Provider)
	assert.Equal(t, "http://agent-harness:3080", cfg.AgentHarness.BaseURL)
	assert.Equal(t, "/osmedeus/workspaces", cfg.AgentHarness.WorkspaceMountPath)
	assert.Equal(t, 7, cfg.AgentHarness.RequestTimeoutSeconds)
	assert.True(t, cfg.AgentHarness.RAGEnabled)
	assert.Equal(t, "http://ollama:11434/v1/embeddings", cfg.AgentHarness.RAGEmbeddingURL)
	assert.Equal(t, "test-embedding", cfg.AgentHarness.RAGEmbeddingModel)
	assert.Equal(t, "token", cfg.AgentHarness.RAGEmbeddingAuthToken)
	assert.Equal(t, 13, cfg.AgentHarness.RAGTimeoutSeconds)
	assert.Equal(t, 250, cfg.AgentHarness.RAGCandidateLimit)
}

func TestSetAgentHarnessConfigRejectsInvalidValues(t *testing.T) {
	cfg := &config.Config{}

	require.Error(t, setConfigValue(cfg, "agent_harness.enabled", "sometimes"))
	require.Error(t, setConfigValue(cfg, "agent_harness.request_timeout_seconds", "0"))
	require.Error(t, setConfigValue(cfg, "agent_harness.rag_enabled", "sometimes"))
	require.Error(t, setConfigValue(cfg, "agent_harness.rag_timeout_seconds", "0"))
	require.Error(t, setConfigValue(cfg, "agent_harness.rag_candidate_limit", "501"))
	require.Error(t, setConfigValue(cfg, "agent_harness.unknown", "value"))
}
