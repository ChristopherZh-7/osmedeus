package parser

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompanyReconFullWorkflowResolvesAndValidates(t *testing.T) {
	workflowRoot := filepath.Join("..", "..", "platform", "osmedeus-workflow")
	loader := NewLoader(workflowRoot)
	workflow, err := loader.LoadWorkflowByPath(filepath.Join(workflowRoot, "company-recon-full.yaml"))
	require.NoError(t, err)
	require.NotNil(t, workflow)
	assert.Equal(t, "company-recon-full", workflow.Name)
	assert.Equal(t, "domain-standard", workflow.ResolvedFrom)
	assert.NotEmpty(t, workflow.Modules, "company flow must inherit the standard domain modules")
	assert.Contains(t, workflow.Tags, "authorized")
}
