package handlers

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/j3ssie/osmedeus/v5/internal/config"
	"github.com/j3ssie/osmedeus/v5/internal/database"
)

func listWorkspaceDirs(workspacesDir string) ([]string, error) {
	if workspacesDir == "" {
		return nil, nil
	}

	entries, err := os.ReadDir(workspacesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if !isValidWorkspaceName(name) {
			continue
		}
		if entry.IsDir() {
			names = append(names, name)
			continue
		}
		if entry.Type()&os.ModeSymlink != 0 {
			info, err := os.Stat(filepath.Join(workspacesDir, name))
			if err == nil && info.IsDir() {
				names = append(names, name)
			}
		}
	}

	sort.Strings(names)
	return names, nil
}

func resolveWorkspacesDirForListing(cfg *config.Config) string {
	configured := ""
	if cfg != nil {
		configured = cfg.GetWorkspacesDir()
	}
	if configured != "" {
		if _, err := os.Stat(configured); err == nil {
			return configured
		}
	}

	if home, err := os.UserHomeDir(); err == nil && home != "" {
		candidate := filepath.Join(home, "workspaces-osmedeus")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	if _, err := os.Stat("/workspaces-osmedeus"); err == nil {
		return "/workspaces-osmedeus"
	}

	return configured
}

type filesystemWorkspaceRecord struct {
	Name        string   `json:"name"`
	LocalPath   string   `json:"local_path,omitempty"`
	DataSource  string   `json:"data_source"`
	TotalAssets int      `json:"total_assets"`
	Tags        []string `json:"tags"`
}

// ListWorkspaces handles listing all workspaces
// @Summary List all workspaces
// @Description Get a list of all run workspaces. By default returns full workspace records from database. Use filesystem=true to list workspaces derived from assets.
// @Tags Workspaces
// @Produce json
// @Param filesystem query bool false "List workspaces from filesystem/assets instead of workspaces table" default(false)
// @Param offset query int false "Number of records to skip" default(0)
// @Param limit query int false "Maximum number of records to return (max 10000)" default(20)
// @Success 200 {object} map[string]interface{} "List of workspaces"
// @Failure 500 {object} map[string]interface{} "Failed to read workspaces"
// @Security BearerAuth
// @Router /osm/api/workspaces [get]
func ListWorkspaces(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Parse query parameters
		filesystem := c.Query("filesystem", "false") == "true"
		offset, _ := strconv.Atoi(c.Query("offset", "0"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))

		// Validate pagination
		if offset < 0 {
			offset = 0
		}
		if limit <= 0 {
			limit = 20
		}
		if limit > 10000 {
			limit = 10000
		}

		ctx := context.Background()

		// Return workspaces based on mode
		if filesystem {
			assetWorkspaces, err := database.ListAllWorkspacesFromAssets(ctx)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error":   true,
					"message": err.Error(),
				})
			}

			inAssetsDBByName := make(map[string]bool, len(assetWorkspaces))
			for _, ws := range assetWorkspaces {
				inAssetsDBByName[ws.Name] = true
			}

			workspacesDir := resolveWorkspacesDirForListing(cfg)
			workspaceDirs, err := listWorkspaceDirs(workspacesDir)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error":   true,
					"message": err.Error(),
				})
			}

			assetCountByName := make(map[string]int, len(assetWorkspaces))
			for _, ws := range assetWorkspaces {
				assetCountByName[ws.Name] = ws.AssetCount
			}

			hasDirByName := make(map[string]bool, len(workspaceDirs))
			for _, name := range workspaceDirs {
				hasDirByName[name] = true
				if _, ok := assetCountByName[name]; !ok {
					assetCountByName[name] = 0
				}
			}

			records := make([]filesystemWorkspaceRecord, 0, len(assetCountByName))
			for name, assetCount := range assetCountByName {
				tags := []string{"filesystem"}
				if hasDirByName[name] && !inAssetsDBByName[name] {
					tags = append(tags, "filesystem-only")
				}
				rec := filesystemWorkspaceRecord{
					Name:        name,
					DataSource:  "filesystem",
					TotalAssets: assetCount,
					Tags:        tags,
				}
				if hasDirByName[name] {
					rec.LocalPath = filepath.Join(workspacesDir, name)
				}
				records = append(records, rec)
			}
			sort.Slice(records, func(i, j int) bool {
				return records[i].Name < records[j].Name
			})

			totalCount := len(records)
			if offset > totalCount {
				offset = totalCount
			}
			end := offset + limit
			if end > totalCount {
				end = totalCount
			}
			page := records[offset:end]

			return c.JSON(fiber.Map{
				"data":           page,
				"workspaces_dir": workspacesDir,
				"pagination": fiber.Map{
					"total":  totalCount,
					"offset": offset,
					"limit":  limit,
				},
			})
		}

		// Default: Get full workspace records from workspaces table
		orgUUID, errResp := ResolveOrgQuery(ctx, c)
		if errResp != nil {
			return errResp
		}

		result, err := database.ListWorkspacesFullFromDB(ctx, offset, limit, orgUUID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   true,
				"message": err.Error(),
			})
		}

		return c.JSON(fiber.Map{
			"data": result.Data,
			"pagination": fiber.Map{
				"total":  result.TotalCount,
				"offset": result.Offset,
				"limit":  result.Limit,
			},
		})
	}
}

// ListWorkspaceNames handles listing workspace names
// @Summary List workspace names
// @Description Get a sorted list of workspace names from the database
// @Tags Workspaces
// @Produce json
// @Success 200 {array} string "Workspace names"
// @Failure 500 {object} map[string]interface{} "Failed to list workspace names"
// @Security BearerAuth
// @Router /osm/api/workspace-names [get]
func ListWorkspaceNames(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx := context.Background()

		db := database.GetDB()
		if db == nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   true,
				"message": "Database not connected",
			})
		}

		var names []string
		if err := db.NewSelect().Model((*database.Workspace)(nil)).Column("name").Order("name ASC").Scan(ctx, &names); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   true,
				"message": err.Error(),
			})
		}

		return c.JSON(names)
	}
}

// workspacePathForDeletion resolves a workspace directory without following
// symlinks. The candidate must be a direct, named child of the configured
// workspaces root so a stale or malicious database path can never widen the
// deletion scope.
func workspacePathForDeletion(cfg *config.Config, name, localPath string) (string, bool, error) {
	root := ""
	if cfg != nil {
		root = cfg.GetWorkspacesDir()
	}
	if root == "" {
		return "", false, nil
	}

	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", false, fmt.Errorf("failed to resolve workspaces directory: %w", err)
	}

	candidate := filepath.Join(absRoot, name)
	if localPath != "" && filepath.Base(filepath.Clean(localPath)) == name {
		if absLocal, err := filepath.Abs(localPath); err == nil {
			if localRel, relErr := filepath.Rel(absRoot, absLocal); relErr == nil && localRel == name {
				candidate = absLocal
			}
		}
	}

	rel, err := filepath.Rel(absRoot, candidate)
	if err != nil || rel == "." || rel != name {
		return "", false, fmt.Errorf("workspace path is outside the configured workspaces directory")
	}

	if _, err := os.Lstat(candidate); err != nil {
		if os.IsNotExist(err) {
			return candidate, false, nil
		}
		return "", false, err
	}
	return candidate, true, nil
}

// DeleteWorkspace permanently removes a workspace's database data and, by
// default, its directory below the configured workspaces root.
// @Summary Delete a workspace
// @Description Permanently delete a workspace, its assets, vulnerabilities, runs, artifacts, diffs, events, and Agent Pentest records. Active workspaces must be stopped first. Schedule definitions are retained.
// @Tags Workspaces
// @Produce json
// @Param name path string true "Workspace name"
// @Param delete_files query bool false "Also delete the local workspace directory" default(true)
// @Success 200 {object} map[string]interface{} "Workspace deleted"
// @Failure 400 {object} map[string]interface{} "Invalid workspace name or path"
// @Failure 404 {object} map[string]interface{} "Workspace not found"
// @Failure 409 {object} map[string]interface{} "Workspace still has active work"
// @Security BearerAuth
// @Router /osm/api/workspaces/{name} [delete]
func DeleteWorkspace(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		name := strings.TrimSpace(c.Params("name"))
		if !isValidWorkspaceName(name) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": true, "message": "invalid workspace name",
			})
		}

		deleteFiles := c.QueryBool("delete_files", true)
		workspacePath := ""
		directoryExists := false
		if deleteFiles {
			localPath := ""
			if workspace, err := database.GetWorkspaceByName(c.UserContext(), name); err == nil {
				localPath = workspace.LocalPath
			}
			var err error
			workspacePath, directoryExists, err = workspacePathForDeletion(cfg, name, localPath)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": true, "message": err.Error(),
				})
			}
		}

		result, dbErr := database.DeleteWorkspaceRecords(c.UserContext(), name)
		if dbErr != nil && !errors.Is(dbErr, database.ErrWorkspaceNotFound) {
			if errors.Is(dbErr, database.ErrWorkspaceActive) {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{
					"error": true, "message": "Stop active scans and Agent Pentest tasks before deleting the workspace",
				})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": true, "message": "failed to delete workspace data",
			})
		}

		if errors.Is(dbErr, database.ErrWorkspaceNotFound) && (!deleteFiles || !directoryExists) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": true, "message": "workspace not found",
			})
		}

		filesDeleted := false
		if deleteFiles && directoryExists {
			if err := os.RemoveAll(workspacePath); err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": true, "message": "workspace data was deleted, but its local directory could not be removed",
				})
			}
			filesDeleted = true
		}

		deleted := map[string]int64{}
		workspaceID := int64(0)
		if result != nil {
			deleted = result.Deleted
			workspaceID = result.Workspace.ID
		}

		return c.JSON(fiber.Map{
			"message":       "workspace deleted successfully",
			"id":            workspaceID,
			"name":          name,
			"deleted":       deleted,
			"files_deleted": filesDeleted,
		})
	}
}

// isValidWorkspaceName validates workspace name to prevent path traversal
func isValidWorkspaceName(name string) bool {
	// Reject empty, ".", "..", or names containing path separators
	if name == "" || name == "." || name == ".." {
		return false
	}
	if strings.Contains(name, "/") || strings.Contains(name, "\\") {
		return false
	}
	if strings.Contains(name, "..") {
		return false
	}
	return true
}

// isPathUnderWorkspace ensures the file path is within the workspace folder
func isPathUnderWorkspace(filePath, workspacePath string) bool {
	if filePath == "" || workspacePath == "" {
		return false
	}
	absFile, err := filepath.Abs(filePath)
	if err != nil {
		return false
	}
	absWorkspace, err := filepath.Abs(workspacePath)
	if err != nil {
		return false
	}

	realFile, err := filepath.EvalSymlinks(absFile)
	if err == nil {
		absFile = realFile
	}
	realWorkspace, err := filepath.EvalSymlinks(absWorkspace)
	if err == nil {
		absWorkspace = realWorkspace
	}

	return strings.HasPrefix(absFile, absWorkspace+string(filepath.Separator)) || absFile == absWorkspace
}
