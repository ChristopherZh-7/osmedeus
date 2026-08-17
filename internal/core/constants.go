package core

// Project metadata constants
const (
	// VERSION of this project
	VERSION = "v5.1.0"
	// DESC description of the tool
	DESC = "A Modern Orchestration Engine for Security"
	// BINARY name of golish
	BINARY = "golish"
	// SNAPSHOT is the short binary name used in snapshot metadata.
	SNAPSHOT = "golish"
	// AUTHOR of this
	AUTHOR = "@ChristopherZh-7"
	// DOCS is the project documentation URL.
	DOCS = "https://github.com/ChristopherZh-7/golish-pentest-platform/tree/main/docs"
	// LICENSE is the license label exposed by the API.
	LICENSE = "open-source"
	// REPO_URL is the canonical project repository.
	REPO_URL = "https://github.com/ChristopherZh-7/golish-pentest-platform"
	// DEFAULT_BASE_REPO default repository for base folder
	DEFAULT_BASE_REPO = "https://github.com/ChristopherZh-7/golish-base.git"
	// DEFAULT_WORKFLOW_REPO default repository for workflows
	DEFAULT_WORKFLOW_REPO = "https://github.com/ChristopherZh-7/golish-workflow.git"
	// METADATA is the default binary registry metadata source.
	METADATA = "https://raw.githubusercontent.com/ChristopherZh-7/golish-registry/main/registry-metadata-direct-fetch.json"
	// INSTALL default install script
	INSTALL = "https://raw.githubusercontent.com/ChristopherZh-7/golish-registry/main/install.sh"
	// DefaultUA is the default User-Agent for HTTP clients
	DefaultUA = "Mozilla/5.0 (compatible; Golish/" + VERSION + "; +" + REPO_URL + ")"
)

var BuildTime = "unknown"
var CommitHash = "unknown"
