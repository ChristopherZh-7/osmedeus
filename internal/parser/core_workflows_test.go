package parser

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/ChristopherZh-7/golish-pentest-platform/v5/internal/core"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBundledCoreWorkflowVisibility(t *testing.T) {
	_, sourceFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	loader := NewLoader(filepath.Join(filepath.Dir(sourceFile), "..", "..", "platform", "golish-workflow"))
	workflows, err := loader.LoadAllWorkflows()
	require.NoError(t, err)

	byName := make(map[string]*core.Workflow, len(workflows))
	for _, workflow := range workflows {
		byName[workflow.Name] = workflow
	}

	for _, name := range []string{"company-recon", "domain-recon", "network-recon", "web-recon", "code-recon"} {
		workflow := byName[name]
		require.NotNil(t, workflow, name)
		assert.Equal(t, core.KindFlow, workflow.Kind, name)
		assert.False(t, workflow.Hidden, name)
		assert.Contains(t, []string(workflow.Tags), "core", name)
	}

	for _, name := range []string{
		"fast", "general", "domain-lite", "domain-standard", "domain-extensive",
		"cidr", "cidr-extensive", "web-analysis", "repo", "sast",
		"company-recon-full", "domain-list-recon",
	} {
		workflow := byName[name]
		require.NotNil(t, workflow, name)
		assert.True(t, workflow.Hidden, name)
	}
}
