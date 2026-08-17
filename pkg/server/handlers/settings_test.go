package handlers

import (
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestRedactSensitiveFieldsRecursively(t *testing.T) {
	input := `server:
  simple_user_map_key:
    operator: account-password
  auth_api_key: server-key
llm_config:
  max_tokens: 4096
  llm_providers:
    - provider: openai
      auth_token: provider-token
global_vars:
  GITHUB_API_KEY:
    value: github-key
    as_env: true
`

	redacted := redactSensitiveFields(input)
	for _, secret := range []string{"account-password", "server-key", "provider-token", "github-key"} {
		if strings.Contains(redacted, secret) {
			t.Fatalf("redacted YAML still contains secret %q", secret)
		}
	}
	if !strings.Contains(redacted, "max_tokens: 4096") {
		t.Fatalf("max_tokens was incorrectly redacted:\n%s", redacted)
	}
	if !strings.Contains(redacted, "operator:") {
		t.Fatalf("account name should remain visible:\n%s", redacted)
	}
	if !strings.Contains(redacted, "as_env: true") {
		t.Fatalf("non-secret global variable metadata should remain visible:\n%s", redacted)
	}

	var parsed map[string]any
	if err := yaml.Unmarshal([]byte(redacted), &parsed); err != nil {
		t.Fatalf("redacted output is not valid YAML: %v", err)
	}
}

func TestRedactSensitiveFieldsFailsClosed(t *testing.T) {
	input := "password: [secret"
	redacted := redactSensitiveFields(input)
	if strings.Contains(redacted, "secret") || !strings.Contains(redacted, "无法安全显示") {
		t.Fatalf("invalid YAML must fail closed: %q", redacted)
	}
}

func TestParseSettingsSkill(t *testing.T) {
	name, description := parseSettingsSkill([]byte("---\nname: osmedeus-expert\ndescription: Workflow guidance\n---\n# Body\n"))
	if name != "osmedeus-expert" || description != "Workflow guidance" {
		t.Fatalf("unexpected metadata: name=%q description=%q", name, description)
	}
}
