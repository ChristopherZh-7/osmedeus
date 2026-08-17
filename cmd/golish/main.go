package main

import (
	"github.com/ChristopherZh-7/golish-pentest-platform/v5/internal/core"
	"github.com/ChristopherZh-7/golish-pentest-platform/v5/pkg/cli"
)

// Build info - set via ldflags during build
var (
	BuildTime  = "unknown"
	CommitHash = "unknown"
)

// @title Golish API
// @version 5.0.2
// @description Workflow Engine for Offensive Security - REST API for managing security automation workflows, scans, and distributed task execution.
// @termsOfService https://github.com/ChristopherZh-7/golish-pentest-platform/tree/main/docs/terms/

// @contact.name Golish Support
// @contact.url https://github.com/golish
// @contact.email support@golish.org

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8811
// @BasePath /
// @schemes http https

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description JWT Bearer token authentication. Format: "Bearer {token}"

func main() {
	core.BuildTime = BuildTime
	core.CommitHash = CommitHash
	cli.SetBuildInfo(BuildTime, CommitHash)
	cli.Execute()
}
