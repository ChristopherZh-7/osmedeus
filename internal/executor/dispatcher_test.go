package executor

import "testing"

func TestResolveDirectExportValuePreservesMarkdown(t *testing.T) {
	markdown := "**Plan**\n1. Check DNS (authorized target only)"
	value, ok := resolveDirectExportValue("{{agent_plan}}", map[string]interface{}{
		"agent_plan": markdown,
	})
	if !ok {
		t.Fatal("expected direct template variable to resolve")
	}
	if value != markdown {
		t.Fatalf("expected Markdown to be preserved, got %q", value)
	}
}

func TestResolveDirectExportValuePreservesType(t *testing.T) {
	value, ok := resolveDirectExportValue("  {{ agent_iterations }}  ", map[string]interface{}{
		"agent_iterations": 3,
	})
	if !ok {
		t.Fatal("expected spaced direct template variable to resolve")
	}
	if value != 3 {
		t.Fatalf("expected integer value 3, got %#v", value)
	}
}

func TestResolveDirectExportValueRejectsEmbeddedTemplate(t *testing.T) {
	if _, ok := resolveDirectExportValue("Plan: {{agent_plan}}", map[string]interface{}{
		"agent_plan": "test",
	}); ok {
		t.Fatal("embedded template should use normal template rendering")
	}
}
