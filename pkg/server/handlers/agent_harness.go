package handlers

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ChristopherZh-7/golish-pentest-platform/v5/internal/config"
	"github.com/gofiber/fiber/v2"
)

const (
	agentHarnessProvider     = "deepseek-harness"
	agentHarnessWebMarker    = "window.__DSH_BOOT__"
	agentHarnessProbeMaxBody = 1 << 20
)

// AgentHarnessStatusData describes the connection between Golish and the
// external interactive agent runtime.
type AgentHarnessStatusData struct {
	Enabled    bool   `json:"enabled"`
	Status     string `json:"status"`
	Provider   string `json:"provider"`
	BaseURL    string `json:"base_url,omitempty"`
	WebURL     string `json:"web_url,omitempty"`
	Connected  bool   `json:"connected"`
	Compatible bool   `json:"compatible"`
	LatencyMS  int64  `json:"latency_ms,omitempty"`
	Error      string `json:"error,omitempty"`
}

// AgentHarnessStatus checks whether the configured DeepSeek Harness Web host
// is reachable and exposes the expected plugin boot contract.
// @Summary Agent Harness connection status
// @Description Check whether the external interactive agent runtime is reachable and compatible
// @Tags Agent Harness
// @Produce json
// @Success 200 {object} AgentHarnessStatusData
// @Router /golish/api/agent-harness/status [get]
func AgentHarnessStatus(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		status := AgentHarnessStatusData{
			Provider: agentHarnessProvider,
			Status:   "disabled",
		}
		if cfg == nil {
			status.Error = "configuration is unavailable"
			return c.JSON(status)
		}

		harnessCfg := cfg.AgentHarness
		status.Enabled = harnessCfg.Enabled
		if harnessCfg.Provider != "" {
			status.Provider = harnessCfg.Provider
		}
		if !harnessCfg.Enabled {
			return c.JSON(status)
		}

		baseURL := harnessCfg.GetBaseURL()
		status.BaseURL = baseURL
		status.WebURL = harnessCfg.GetPublicURL()
		parsed, err := url.Parse(baseURL)
		if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			status.Status = "unavailable"
			status.Error = "agent_harness.base_url must be an http or https URL"
			return c.JSON(status)
		}

		startedAt := time.Now()
		req, err := http.NewRequestWithContext(c.UserContext(), http.MethodGet, baseURL+"/", nil)
		if err != nil {
			status.Status = "unavailable"
			status.Error = err.Error()
			return c.JSON(status)
		}
		req.Header.Set("Accept", "text/html")

		client := &http.Client{Timeout: harnessCfg.GetRequestTimeout()}
		resp, err := client.Do(req)
		status.LatencyMS = time.Since(startedAt).Milliseconds()
		if err != nil {
			status.Status = "unavailable"
			status.Error = fmt.Sprintf("Harness connection failed: %v", err)
			return c.JSON(status)
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(io.LimitReader(resp.Body, agentHarnessProbeMaxBody))
		if err != nil {
			status.Status = "unavailable"
			status.Error = fmt.Sprintf("Harness response could not be read: %v", err)
			return c.JSON(status)
		}

		status.Connected = resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices
		status.Compatible = status.Connected && strings.Contains(string(body), agentHarnessWebMarker)
		switch {
		case status.Compatible:
			status.Status = "ready"
		case status.Connected:
			status.Status = "incompatible"
			status.Error = "reachable service does not expose the DeepSeek Harness Web boot contract"
		default:
			status.Status = "unavailable"
			status.Error = fmt.Sprintf("Harness returned HTTP %d", resp.StatusCode)
		}

		return c.JSON(status)
	}
}
