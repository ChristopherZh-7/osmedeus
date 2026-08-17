package handlers

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/j3ssie/osmedeus/v5/internal/config"
	"github.com/j3ssie/osmedeus/v5/internal/core"
	"github.com/j3ssie/osmedeus/v5/public"
	"gopkg.in/yaml.v3"
)

// GetSettings returns basic settings
func GetSettings(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"base_folder": cfg.BaseFolder,
			"server": fiber.Map{
				"host": cfg.Server.Host,
				"port": cfg.Server.Port,
			},
			"version": core.VERSION,
		})
	}
}

type settingsLLMProviderView struct {
	Provider       string `json:"provider"`
	BaseURL        string `json:"base_url"`
	Model          string `json:"model"`
	AuthConfigured bool   `json:"auth_configured"`
}

type settingsLLMProviderInput struct {
	Provider      string `json:"provider"`
	BaseURL       string `json:"base_url"`
	Model         string `json:"model"`
	AuthToken     string `json:"auth_token"`
	KeepAuthToken bool   `json:"keep_auth_token"`
}

type settingsAIUpdateRequest struct {
	Providers            []settingsLLMProviderInput `json:"providers"`
	EnabledToolCall      bool                       `json:"enabled_tool_call"`
	MaxTokens            int                        `json:"max_tokens"`
	Temperature          float64                    `json:"temperature"`
	TopK                 int                        `json:"top_k"`
	TopP                 float64                    `json:"top_p"`
	MaxRetries           int                        `json:"max_retries"`
	Timeout              string                     `json:"timeout"`
	Stream               bool                       `json:"stream"`
	StructuredJSONFormat bool                       `json:"structured_json_format"`
}

type settingsIntegrationInput struct {
	ID         string `json:"id"`
	APIKey     string `json:"api_key"`
	Email      string `json:"email"`
	KeepAPIKey bool   `json:"keep_api_key"`
	KeepEmail  bool   `json:"keep_email"`
}

type settingsIntegrationsUpdateRequest struct {
	Providers []settingsIntegrationInput `json:"providers"`
}

type companyIntegrationSpec struct {
	ID            string
	Label         string
	APIKeyVar     string
	EmailVar      string
	RequiresEmail bool
}

var companyIntegrationSpecs = []companyIntegrationSpec{
	{ID: "fofa", Label: "FOFA", APIKeyVar: "FOFA_API_KEY", EmailVar: "FOFA_EMAIL", RequiresEmail: true},
	{ID: "quake", Label: "Quake", APIKeyVar: "QUAKE_API_KEY"},
	{ID: "hunter", Label: "Hunter", APIKeyVar: "HUNTER_API_KEY"},
	{ID: "zerozone", Label: "0.zone", APIKeyVar: "ZEROZONE_API_KEY"},
}

type settingsSkillView struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Kind        string `json:"kind"`
	Source      string `json:"source"`
	Status      string `json:"status"`
	References  int    `json:"references,omitempty"`
	Editable    bool   `json:"editable"`
}

func loadSettingsConfig(cfg *config.Config) (*config.Config, string, error) {
	if cfg == nil || strings.TrimSpace(cfg.BaseFolder) == "" {
		return nil, "", fmt.Errorf("configuration is unavailable")
	}
	settingsPath := filepath.Join(cfg.BaseFolder, "osm-settings.yaml")
	if resolved, err := filepath.EvalSymlinks(settingsPath); err == nil {
		settingsPath = resolved
	}
	fresh, err := config.LoadFromFile(settingsPath)
	if err != nil {
		return nil, settingsPath, err
	}
	return fresh, settingsPath, nil
}

func llmProviderViews(cfg *config.Config) []settingsLLMProviderView {
	providers := make([]settingsLLMProviderView, 0, len(cfg.LLM.LLMProviders))
	for _, provider := range cfg.LLM.LLMProviders {
		providers = append(providers, settingsLLMProviderView{
			Provider:       provider.Provider,
			BaseURL:        provider.BaseURL,
			Model:          provider.Model,
			AuthConfigured: strings.TrimSpace(provider.AuthToken) != "",
		})
	}
	return providers
}

func settingsIntegrationViews(cfg *config.Config) []fiber.Map {
	result := []fiber.Map{
		{"id": "github", "label": "GitHub", "configured": strings.TrimSpace(cfg.GlobalVars["GITHUB_API_KEY"].Value) != "", "kind": "general"},
		{"id": "shodan", "label": "Shodan", "configured": strings.TrimSpace(cfg.GlobalVars["SHODAN_API_KEY"].Value) != "", "kind": "general"},
		{"id": "censys", "label": "Censys", "configured": strings.TrimSpace(cfg.GlobalVars["CENSYS_API_KEY"].Value) != "", "kind": "general"},
		{"id": "passivetotal", "label": "PassiveTotal", "configured": strings.TrimSpace(cfg.GlobalVars["PASSIVETOTAL_API_KEY"].Value) != "", "kind": "general"},
	}
	for _, spec := range companyIntegrationSpecs {
		configured := strings.TrimSpace(cfg.GlobalVars[spec.APIKeyVar].Value) != ""
		if spec.RequiresEmail {
			configured = configured && strings.TrimSpace(cfg.GlobalVars[spec.EmailVar].Value) != ""
		}
		result = append(result, fiber.Map{"id": spec.ID, "label": spec.Label, "configured": configured, "kind": "company_intel", "requires_email": spec.RequiresEmail})
	}
	return result
}

// GetProductSettings returns a product-oriented settings projection. Secrets
// are represented only as configured/not-configured booleans.
func GetProductSettings(cfg *config.Config, hotConfig *config.HotReloadableConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		fresh, _, err := loadSettingsConfig(cfg)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": err.Error()})
		}
		integrations := settingsIntegrationViews(fresh)
		return c.JSON(fiber.Map{
			"version": core.VERSION,
			"llm": fiber.Map{
				"configured":             fresh.IsLLMConfigured(),
				"providers":              llmProviderViews(fresh),
				"enabled_tool_call":      fresh.LLM.EnabledToolCall,
				"max_tokens":             fresh.LLM.MaxTokens,
				"temperature":            fresh.LLM.Temperature,
				"top_k":                  fresh.LLM.TopK,
				"top_p":                  fresh.LLM.TopP,
				"max_retries":            fresh.LLM.MaxRetries,
				"timeout":                fresh.LLM.Timeout,
				"stream":                 fresh.LLM.Stream,
				"structured_json_format": fresh.LLM.StructuredJSONFormat,
			},
			"agent_harness": fiber.Map{
				"enabled":        fresh.AgentHarness.Enabled,
				"provider":       fresh.AgentHarness.Provider,
				"base_url":       fresh.AgentHarness.BaseURL,
				"web_ui_enabled": fresh.AgentHarness.IsWebUIEnabled(),
				"public_url":     fresh.AgentHarness.PublicURL,
			},
			"scan_tactic":  fresh.ScanTactic,
			"integrations": integrations,
			"system": fiber.Map{
				"base_folder":          fresh.BaseFolder,
				"database_engine":      fresh.Database.DBEngine,
				"redis_configured":     fresh.IsRedisConfigured(),
				"storage_configured":   fresh.IsStorageConfigured(),
				"notification_enabled": fresh.Notification.Enabled,
				"cloud_enabled":        fresh.Cloud.Enabled,
				"hot_reload_enabled":   hotConfig != nil,
			},
		})
	}
}

// UpdateIntegrationSettings stores passive-intelligence credentials as
// write-only global vars. Blank values preserve existing credentials only when
// the caller explicitly asks to keep them.
func UpdateIntegrationSettings(cfg *config.Config, hotConfig *config.HotReloadableConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req settingsIntegrationsUpdateRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "请求格式无效"})
		}
		if len(req.Providers) == 0 || len(req.Providers) > len(companyIntegrationSpecs) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "情报源列表无效"})
		}
		fresh, settingsPath, err := loadSettingsConfig(cfg)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": err.Error()})
		}
		if fresh.GlobalVars == nil {
			fresh.GlobalVars = config.GlobalVarsConfig{}
		}
		specByID := make(map[string]companyIntegrationSpec, len(companyIntegrationSpecs))
		for _, spec := range companyIntegrationSpecs {
			specByID[spec.ID] = spec
		}
		seen := map[string]bool{}
		for _, input := range req.Providers {
			id := strings.ToLower(strings.TrimSpace(input.ID))
			spec, ok := specByID[id]
			if !ok || seen[id] {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "未知或重复的情报源：" + id})
			}
			seen[id] = true
			apiKey := strings.TrimSpace(input.APIKey)
			if input.KeepAPIKey && apiKey == "" {
				apiKey = fresh.GlobalVars[spec.APIKeyVar].Value
			}
			fresh.GlobalVars[spec.APIKeyVar] = config.GlobalVar{Value: apiKey, AsEnv: boolPointer(false)}
			if spec.RequiresEmail {
				email := strings.TrimSpace(input.Email)
				if input.KeepEmail && email == "" {
					email = fresh.GlobalVars[spec.EmailVar].Value
				}
				fresh.GlobalVars[spec.EmailVar] = config.GlobalVar{Value: email, AsEnv: boolPointer(false)}
			}
		}
		backupPath, err := writeConfigAtomically(settingsPath, fresh)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": err.Error()})
		}
		active := fresh
		if hotConfig != nil {
			if err := hotConfig.Reload(); err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": "配置已写入但重新加载失败：" + err.Error()})
			}
			active = hotConfig.Get()
		} else {
			active.ResolvePaths()
		}
		if cfg != nil && active != cfg {
			*cfg = *active
		}
		config.Set(active)
		return c.JSON(fiber.Map{"message": "外部情报源配置已保存", "backup": backupPath, "integrations": settingsIntegrationViews(active)})
	}
}

func boolPointer(value bool) *bool { return &value }

func writeConfigAtomically(settingsPath string, cfg *config.Config) (string, error) {
	data, err := cfg.ToYAML()
	if err != nil {
		return "", err
	}
	if _, err := config.ParseConfigStrict(data); err != nil {
		return "", fmt.Errorf("invalid configuration: %w", err)
	}

	current, err := os.ReadFile(settingsPath)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(settingsPath)
	if err != nil {
		return "", err
	}
	backupPath := settingsPath + ".backup"
	if err := os.WriteFile(backupPath, current, info.Mode().Perm()); err != nil {
		return "", fmt.Errorf("write backup: %w", err)
	}

	tmp, err := os.CreateTemp(filepath.Dir(settingsPath), ".osm-settings-*.tmp")
	if err != nil {
		return "", err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if err := tmp.Chmod(info.Mode().Perm()); err != nil {
		_ = tmp.Close()
		return "", err
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return "", err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	if err := os.Rename(tmpPath, settingsPath); err != nil {
		return "", err
	}
	return backupPath, nil
}

// UpdateAISettings updates the platform LLM configuration. Existing tokens
// remain write-only and can be preserved without returning them to the browser.
func UpdateAISettings(cfg *config.Config, hotConfig *config.HotReloadableConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req settingsAIUpdateRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "请求格式无效"})
		}
		if len(req.Providers) == 0 || len(req.Providers) > 10 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "至少需要一个模型服务商，最多 10 个"})
		}
		if req.MaxTokens < 1 || req.MaxTokens > 1000000 || req.Temperature < 0 || req.Temperature > 2 || req.TopP < 0 || req.TopP > 1 || req.TopK < 0 || req.MaxRetries < 0 || strings.TrimSpace(req.Timeout) == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "模型参数超出允许范围"})
		}
		if _, err := time.ParseDuration(req.Timeout); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "超时时间格式无效，例如 120s 或 2m"})
		}

		fresh, settingsPath, err := loadSettingsConfig(cfg)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": err.Error()})
		}
		providers := make([]config.LLMProvider, 0, len(req.Providers))
		for i, input := range req.Providers {
			input.Provider = strings.TrimSpace(input.Provider)
			input.BaseURL = strings.TrimSpace(input.BaseURL)
			input.Model = strings.TrimSpace(input.Model)
			if input.Provider == "" || input.BaseURL == "" || input.Model == "" {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": fmt.Sprintf("第 %d 个服务商缺少名称、接口地址或模型", i+1)})
			}
			authToken := strings.TrimSpace(input.AuthToken)
			if input.KeepAuthToken && authToken == "" && i < len(fresh.LLM.LLMProviders) {
				authToken = fresh.LLM.LLMProviders[i].AuthToken
			}
			providers = append(providers, config.LLMProvider{Provider: input.Provider, BaseURL: input.BaseURL, AuthToken: authToken, Model: input.Model})
		}
		fresh.LLM.LLMProviders = providers
		fresh.LLM.EnabledToolCall = req.EnabledToolCall
		fresh.LLM.MaxTokens = req.MaxTokens
		fresh.LLM.Temperature = req.Temperature
		fresh.LLM.TopK = req.TopK
		fresh.LLM.TopP = req.TopP
		fresh.LLM.MaxRetries = req.MaxRetries
		fresh.LLM.Timeout = req.Timeout
		fresh.LLM.Stream = req.Stream
		fresh.LLM.StructuredJSONFormat = req.StructuredJSONFormat

		backupPath, err := writeConfigAtomically(settingsPath, fresh)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": err.Error()})
		}

		active := fresh
		if hotConfig != nil {
			if err := hotConfig.Reload(); err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": "配置已写入但重新加载失败：" + err.Error()})
			}
			active = hotConfig.Get()
		} else {
			active.ResolvePaths()
		}
		if cfg != nil && active != cfg {
			*cfg = *active
		}
		config.Set(active)

		return c.JSON(fiber.Map{"message": "AI 配置已保存", "backup": backupPath, "llm": fiber.Map{"configured": active.IsLLMConfigured(), "providers": llmProviderViews(active)}})
	}
}

func parseSettingsSkill(raw []byte) (string, string) {
	content := strings.TrimSpace(strings.TrimPrefix(string(raw), "\ufeff"))
	if !strings.HasPrefix(content, "---") {
		return "", ""
	}
	frontmatter, _, ok := strings.Cut(strings.TrimPrefix(content, "---"), "\n---")
	if !ok {
		return "", ""
	}
	var metadata struct {
		Name        string `yaml:"name"`
		Description string `yaml:"description"`
	}
	if err := yaml.Unmarshal([]byte(frontmatter), &metadata); err != nil {
		return "", ""
	}
	return strings.TrimSpace(metadata.Name), strings.TrimSpace(metadata.Description)
}

func loadEmbeddedSettingsSkills() []settingsSkillView {
	entries, err := fs.ReadDir(public.EmbedFS, "skills")
	if err != nil {
		return nil
	}
	result := make([]settingsSkillView, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		raw, err := public.EmbedFS.ReadFile("skills/" + entry.Name() + "/SKILL.md")
		if err != nil {
			continue
		}
		name, description := parseSettingsSkill(raw)
		if name == "" {
			name = entry.Name()
		}
		refs, _ := fs.ReadDir(public.EmbedFS, "skills/"+entry.Name()+"/references")
		result = append(result, settingsSkillView{Slug: entry.Name(), Name: name, Description: description, Kind: "coding", Source: "平台内置", Status: "available", References: len(refs), Editable: false})
	}
	return result
}

func loadRuntimeSettingsSkills(cfg *config.Config) []settingsSkillView {
	if cfg == nil || strings.TrimSpace(cfg.BaseFolder) == "" {
		return nil
	}
	root := filepath.Join(cfg.BaseFolder, "agent-harness", "dsh-home", "skills")
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	result := make([]settingsSkillView, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(root, entry.Name(), "SKILL.md"))
		if err != nil {
			continue
		}
		name, description := parseSettingsSkill(raw)
		if name == "" {
			name = entry.Name()
		}
		refs, _ := os.ReadDir(filepath.Join(root, entry.Name(), "references"))
		result = append(result, settingsSkillView{Slug: entry.Name(), Name: name, Description: description, Kind: "pentest", Source: "智能渗透运行时", Status: "loaded", References: len(refs), Editable: true})
	}
	return result
}

// ListSettingsSkills exposes both platform coding skills and the Skills loaded
// by the isolated intelligent-pentest runtime.
func ListSettingsSkills(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		coding := loadEmbeddedSettingsSkills()
		pentest := loadRuntimeSettingsSkills(cfg)
		sort.Slice(coding, func(i, j int) bool { return coding[i].Name < coding[j].Name })
		sort.Slice(pentest, func(i, j int) bool { return pentest[i].Name < pentest[j].Name })
		return c.JSON(fiber.Map{"coding": coding, "pentest": pentest, "total": len(coding) + len(pentest)})
	}
}

// // UpdateSettings handles settings update
// func UpdateSettings(c *fiber.Ctx) error {
// 	return c.JSON(fiber.Map{"message": "Settings updated"})
// }

// GetSettingsYAML returns the entire YAML configuration with sensitive fields redacted
// @Summary Get YAML configuration
// @Description Returns the entire configuration file with sensitive fields redacted
// @Tags Settings
// @Produce text/yaml
// @Success 200 {string} string "YAML configuration content"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Security BearerAuth
// @Router /osm/api/settings/yaml [get]
func GetSettingsYAML(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Read the config file
		settingsPath := filepath.Join(cfg.BaseFolder, "osm-settings.yaml")
		content, err := os.ReadFile(settingsPath)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   true,
				"message": fmt.Sprintf("Failed to read config file: %v", err),
			})
		}

		// Redact sensitive fields
		redactedContent := redactSensitiveFields(string(content))

		// Return as YAML
		c.Set("Content-Type", "text/yaml")
		return c.SendString(redactedContent)
	}
}

func isSensitiveSettingsKey(key string) bool {
	key = strings.ToLower(strings.TrimSpace(key))
	return key == "token" ||
		strings.Contains(key, "password") ||
		strings.Contains(key, "passphrase") ||
		strings.Contains(key, "secret") ||
		strings.Contains(key, "credential") ||
		strings.HasSuffix(key, "_token") ||
		strings.HasSuffix(key, "_key")
}

func redactSettingsScalar(node *yaml.Node) {
	node.Kind = yaml.ScalarNode
	node.Tag = "!!str"
	node.Value = "[REDACTED]"
	node.Content = nil
}

// redactSensitiveSettingsValue preserves useful structure when the sensitive
// value is an object (for example global_vars.GITHUB_API_KEY.value/as_env).
func redactSensitiveSettingsValue(node *yaml.Node) {
	switch node.Kind {
	case yaml.MappingNode:
		for i := 0; i+1 < len(node.Content); i += 2 {
			key := strings.ToLower(strings.TrimSpace(node.Content[i].Value))
			value := node.Content[i+1]
			if key == "value" || isSensitiveSettingsKey(key) {
				redactSettingsScalar(value)
				continue
			}
			redactSettingsNode(value)
		}
	case yaml.SequenceNode:
		for _, child := range node.Content {
			redactSensitiveSettingsValue(child)
		}
	default:
		redactSettingsScalar(node)
	}
}

func redactSettingsNode(node *yaml.Node) {
	if node.Kind != yaml.MappingNode {
		for _, child := range node.Content {
			redactSettingsNode(child)
		}
		return
	}

	for i := 0; i+1 < len(node.Content); i += 2 {
		key := strings.ToLower(strings.TrimSpace(node.Content[i].Value))
		value := node.Content[i+1]

		// simple_user_map_key is username -> password. Usernames are useful for
		// troubleshooting, but every value must remain write-only.
		if key == "simple_user_map_key" && value.Kind == yaml.MappingNode {
			for j := 1; j < len(value.Content); j += 2 {
				redactSettingsScalar(value.Content[j])
			}
			continue
		}
		if isSensitiveSettingsKey(key) {
			redactSensitiveSettingsValue(value)
			continue
		}
		redactSettingsNode(value)
	}
}

// redactSensitiveFields parses YAML structurally so nested credentials are
// never exposed and benign names such as max_tokens are not false positives.
func redactSensitiveFields(content string) string {
	var document yaml.Node
	if err := yaml.Unmarshal([]byte(content), &document); err != nil {
		return "# 配置无法安全显示：YAML 解析失败\n"
	}
	redactSettingsNode(&document)
	redacted, err := yaml.Marshal(&document)
	if err != nil {
		return "# 配置无法安全显示：YAML 输出失败\n"
	}
	return string(redacted)
}

// // UpdateSettingsYAML replaces the entire YAML configuration
// // @Summary Update YAML configuration
// // @Description Replaces the entire configuration file with the provided YAML content
// // @Tags Settings
// // @Accept text/yaml
// // @Produce json
// // @Param config body string true "YAML configuration content"
// // @Success 200 {object} map[string]interface{} "Configuration updated successfully"
// // @Failure 400 {object} map[string]interface{} "Invalid YAML"
// // @Failure 500 {object} map[string]interface{} "Internal server error"
// // @Security BearerAuth
// // @Router /osm/api/settings/yaml [put]
// func UpdateSettingsYAML(cfg *config.Config) fiber.Handler {
// 	return func(c *fiber.Ctx) error {
// 		return c.Status(fiber.StatusMethodNotAllowed).JSON(fiber.Map{
// 			"error":   true,
// 			"message": "Updating osm-settings.yaml via API is disabled",
// 		})
// 	}
// }

// ReloadConfig forces a configuration reload (hot reload must be enabled)
// @Summary Force config reload
// @Description Forces an immediate reload of the configuration file. Hot reload must be enabled.
// @Tags Settings
// @Produce json
// @Success 200 {object} map[string]interface{} "Configuration reloaded successfully"
// @Failure 400 {object} map[string]interface{} "Hot reload not enabled"
// @Failure 500 {object} map[string]interface{} "Failed to reload configuration"
// @Security BearerAuth
// @Router /osm/api/settings/reload [post]
func ReloadConfig(hotConfig *config.HotReloadableConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if hotConfig == nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":   true,
				"message": "Hot reload is not enabled. Start server with --hot-reload flag.",
			})
		}

		startTime := time.Now()
		if err := hotConfig.Reload(); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   true,
				"message": fmt.Sprintf("Failed to reload config: %v", err),
			})
		}

		return c.JSON(fiber.Map{
			"message":     "Configuration reloaded successfully",
			"version":     hotConfig.GetVersion(),
			"reload_time": time.Since(startTime).String(),
		})
	}
}

// GetConfigStatus returns the current configuration status including hot reload info
// @Summary Get config status
// @Description Returns the current configuration version and hot reload status
// @Tags Settings
// @Produce json
// @Success 200 {object} map[string]interface{} "Configuration status"
// @Security BearerAuth
// @Router /osm/api/settings/status [get]
func GetConfigStatus(hotConfig *config.HotReloadableConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if hotConfig == nil {
			return c.JSON(fiber.Map{
				"hot_reload_enabled": false,
				"version":            core.VERSION,
			})
		}

		cfg := hotConfig.Get()
		return c.JSON(fiber.Map{
			"hot_reload_enabled":  true,
			"config_version":      hotConfig.GetVersion(),
			"config_path":         hotConfig.GetConfigPath(),
			"watcher_running":     hotConfig.IsRunning(),
			"callback_count":      hotConfig.CallbackCount(),
			"server_version":      core.VERSION,
			"base_folder":         cfg.BaseFolder,
			"server_port":         cfg.Server.Port,
			"database_engine":     cfg.Database.DBEngine,
			"redis_configured":    cfg.IsRedisConfigured(),
			"storage_configured":  cfg.IsStorageConfigured(),
			"llm_configured":      cfg.IsLLMConfigured(),
			"telegram_configured": cfg.IsTelegramConfigured(),
		})
	}
}
