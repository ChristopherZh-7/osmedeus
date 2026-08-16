package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/j3ssie/osmedeus/v5/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func requestAgentHarnessStatus(t *testing.T, cfg *config.Config) AgentHarnessStatusData {
	t.Helper()
	app := fiber.New()
	app.Get("/status", AgentHarnessStatus(cfg))

	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/status", nil))
	require.NoError(t, err)
	defer resp.Body.Close()

	var result AgentHarnessStatusData
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&result))
	return result
}

func TestAgentHarnessStatusReady(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`<html><script>window.__DSH_BOOT__ = {}</script></html>`))
	}))
	defer upstream.Close()

	result := requestAgentHarnessStatus(t, &config.Config{
		AgentHarness: config.AgentHarnessConfig{
			Enabled:               true,
			Provider:              "deepseek-harness",
			BaseURL:               upstream.URL,
			PublicURL:             "http://127.0.0.1:3080",
			RequestTimeoutSeconds: 1,
		},
	})

	assert.Equal(t, "ready", result.Status)
	assert.True(t, result.Connected)
	assert.True(t, result.Compatible)
	assert.Equal(t, "http://127.0.0.1:3080", result.WebURL)
	assert.Empty(t, result.Error)
}

func TestAgentHarnessStatusIncompatible(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("not a Harness Web host"))
	}))
	defer upstream.Close()

	result := requestAgentHarnessStatus(t, &config.Config{
		AgentHarness: config.AgentHarnessConfig{
			Enabled: true,
			BaseURL: upstream.URL,
		},
	})

	assert.Equal(t, "incompatible", result.Status)
	assert.True(t, result.Connected)
	assert.False(t, result.Compatible)
	assert.NotEmpty(t, result.Error)
}

func TestAgentHarnessStatusDisabled(t *testing.T) {
	result := requestAgentHarnessStatus(t, &config.Config{})

	assert.Equal(t, "disabled", result.Status)
	assert.False(t, result.Enabled)
	assert.False(t, result.Connected)
}

func TestAgentHarnessStatusRejectsInvalidURL(t *testing.T) {
	result := requestAgentHarnessStatus(t, &config.Config{
		AgentHarness: config.AgentHarnessConfig{
			Enabled: true,
			BaseURL: "file:///tmp/not-a-service",
		},
	})

	assert.Equal(t, "unavailable", result.Status)
	assert.Contains(t, result.Error, "http or https")
}
