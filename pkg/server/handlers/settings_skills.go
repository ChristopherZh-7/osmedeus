package handlers

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/j3ssie/osmedeus/v5/internal/config"
	"gopkg.in/yaml.v3"
)

const maxSettingsSkillSize = 512 * 1024

var settingsSkillSlugPattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$`)

type settingsSkillWriteRequest struct {
	Slug    string `json:"slug"`
	Content string `json:"content"`
}

type settingsSkillDetail struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Kind        string `json:"kind"`
	Source      string `json:"source"`
	Status      string `json:"status"`
	References  int    `json:"references,omitempty"`
	Editable    bool   `json:"editable"`
	Content     string `json:"content"`
}

type settingsSkillMetadata struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
}

func settingsSkillsRoot(cfg *config.Config) (string, error) {
	if cfg == nil || strings.TrimSpace(cfg.BaseFolder) == "" {
		return "", errors.New("configuration is unavailable")
	}
	return filepath.Join(cfg.BaseFolder, "agent-harness", "dsh-home", "skills"), nil
}

func validateSettingsSkillSlug(slug string) error {
	if !settingsSkillSlugPattern.MatchString(slug) {
		return errors.New("Skill 标识只能包含小写字母、数字和连字符，长度为 1–64 个字符")
	}
	return nil
}

func validateSettingsSkillContent(slug, content string) (settingsSkillMetadata, error) {
	var metadata settingsSkillMetadata
	if content == "" {
		return metadata, errors.New("SKILL.md 内容不能为空")
	}
	if len(content) > maxSettingsSkillSize {
		return metadata, fmt.Errorf("SKILL.md 不能超过 %d KiB", maxSettingsSkillSize/1024)
	}

	normalized := strings.TrimPrefix(strings.ReplaceAll(content, "\r\n", "\n"), "\ufeff")
	lines := strings.Split(normalized, "\n")
	if len(lines) < 3 || strings.TrimSpace(lines[0]) != "---" {
		return metadata, errors.New("SKILL.md 必须以 YAML frontmatter（---）开头")
	}
	closing := -1
	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			closing = i
			break
		}
	}
	if closing < 0 {
		return metadata, errors.New("SKILL.md 缺少 YAML frontmatter 结束标记（---）")
	}
	if err := yaml.Unmarshal([]byte(strings.Join(lines[1:closing], "\n")), &metadata); err != nil {
		return metadata, fmt.Errorf("YAML frontmatter 无效：%w", err)
	}
	metadata.Name = strings.TrimSpace(metadata.Name)
	metadata.Description = strings.TrimSpace(metadata.Description)
	if metadata.Name == "" || metadata.Description == "" {
		return metadata, errors.New("YAML frontmatter 必须包含 name 和 description")
	}
	if metadata.Name != slug {
		return metadata, fmt.Errorf("YAML frontmatter 中的 name 必须与 Skill 标识 %q 一致", slug)
	}
	return metadata, nil
}

func inspectSettingsSkillDirectory(root, slug string) (string, os.FileInfo, error) {
	dir := filepath.Join(root, slug)
	info, err := os.Lstat(dir)
	if err != nil {
		return dir, nil, err
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return dir, nil, errors.New("Skill 路径不是可管理的目录")
	}
	return dir, info, nil
}

func readSettingsSkill(cfg *config.Config, slug string) (settingsSkillDetail, error) {
	var result settingsSkillDetail
	root, err := settingsSkillsRoot(cfg)
	if err != nil {
		return result, err
	}
	dir, _, err := inspectSettingsSkillDirectory(root, slug)
	if err != nil {
		return result, err
	}
	skillPath := filepath.Join(dir, "SKILL.md")
	info, err := os.Lstat(skillPath)
	if err != nil {
		return result, err
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.Mode().IsRegular() {
		return result, errors.New("SKILL.md 不是可管理的普通文件")
	}
	if info.Size() > maxSettingsSkillSize {
		return result, fmt.Errorf("SKILL.md 不能超过 %d KiB", maxSettingsSkillSize/1024)
	}
	raw, err := os.ReadFile(skillPath)
	if err != nil {
		return result, err
	}
	name, description := parseSettingsSkill(raw)
	if name == "" {
		name = slug
	}
	refs, _ := os.ReadDir(filepath.Join(dir, "references"))
	return settingsSkillDetail{
		Slug:        slug,
		Name:        name,
		Description: description,
		Kind:        "pentest",
		Source:      "智能渗透运行时",
		Status:      "loaded",
		References:  len(refs),
		Editable:    true,
		Content:     string(raw),
	}, nil
}

func writeSettingsSkillFile(dir, content string, mode os.FileMode) error {
	tmp, err := os.CreateTemp(dir, ".SKILL.md-*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if err := tmp.Chmod(mode.Perm()); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.WriteString(content); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpPath, filepath.Join(dir, "SKILL.md"))
}

func settingsSkillError(c *fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(fiber.Map{"error": true, "message": message})
}

// GetSettingsSkill returns the editable SKILL.md for one intelligent-pentest Skill.
func GetSettingsSkill(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		slug := c.Params("slug")
		if err := validateSettingsSkillSlug(slug); err != nil {
			return settingsSkillError(c, fiber.StatusBadRequest, err.Error())
		}
		skill, err := readSettingsSkill(cfg, slug)
		if errors.Is(err, os.ErrNotExist) {
			return settingsSkillError(c, fiber.StatusNotFound, "Skill 不存在")
		}
		if err != nil {
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(skill)
	}
}

// CreateSettingsSkill creates a Skill in the intelligent-pentest runtime directory.
func CreateSettingsSkill(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req settingsSkillWriteRequest
		if err := c.BodyParser(&req); err != nil {
			return settingsSkillError(c, fiber.StatusBadRequest, "请求格式无效")
		}
		req.Slug = strings.TrimSpace(req.Slug)
		if err := validateSettingsSkillSlug(req.Slug); err != nil {
			return settingsSkillError(c, fiber.StatusBadRequest, err.Error())
		}
		if _, err := validateSettingsSkillContent(req.Slug, req.Content); err != nil {
			return settingsSkillError(c, fiber.StatusBadRequest, err.Error())
		}
		root, err := settingsSkillsRoot(cfg)
		if err != nil {
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		if err := os.MkdirAll(root, 0o755); err != nil {
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		if info, err := os.Lstat(root); err != nil || info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
			return settingsSkillError(c, fiber.StatusInternalServerError, "Skills 根路径不是可管理的目录")
		}
		dir := filepath.Join(root, req.Slug)
		if err := os.Mkdir(dir, 0o755); err != nil {
			if errors.Is(err, os.ErrExist) {
				return settingsSkillError(c, fiber.StatusConflict, "Skill 标识已存在")
			}
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		if err := writeSettingsSkillFile(dir, req.Content, 0o644); err != nil {
			_ = os.RemoveAll(dir)
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		skill, err := readSettingsSkill(cfg, req.Slug)
		if err != nil {
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(skill)
	}
}

// UpdateSettingsSkill atomically replaces one intelligent-pentest SKILL.md.
func UpdateSettingsSkill(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		slug := c.Params("slug")
		if err := validateSettingsSkillSlug(slug); err != nil {
			return settingsSkillError(c, fiber.StatusBadRequest, err.Error())
		}
		var req settingsSkillWriteRequest
		if err := c.BodyParser(&req); err != nil {
			return settingsSkillError(c, fiber.StatusBadRequest, "请求格式无效")
		}
		if _, err := validateSettingsSkillContent(slug, req.Content); err != nil {
			return settingsSkillError(c, fiber.StatusBadRequest, err.Error())
		}
		root, err := settingsSkillsRoot(cfg)
		if err != nil {
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		dir, _, err := inspectSettingsSkillDirectory(root, slug)
		if errors.Is(err, os.ErrNotExist) {
			return settingsSkillError(c, fiber.StatusNotFound, "Skill 不存在")
		}
		if err != nil {
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		info, err := os.Lstat(filepath.Join(dir, "SKILL.md"))
		if errors.Is(err, os.ErrNotExist) {
			return settingsSkillError(c, fiber.StatusNotFound, "Skill 不存在")
		}
		if err != nil || info.Mode()&os.ModeSymlink != 0 || !info.Mode().IsRegular() {
			return settingsSkillError(c, fiber.StatusInternalServerError, "SKILL.md 不是可管理的普通文件")
		}
		if err := writeSettingsSkillFile(dir, req.Content, info.Mode().Perm()); err != nil {
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		skill, err := readSettingsSkill(cfg, slug)
		if err != nil {
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(skill)
	}
}

// DeleteSettingsSkill removes one intelligent-pentest Skill and its references.
func DeleteSettingsSkill(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		slug := c.Params("slug")
		if err := validateSettingsSkillSlug(slug); err != nil {
			return settingsSkillError(c, fiber.StatusBadRequest, err.Error())
		}
		root, err := settingsSkillsRoot(cfg)
		if err != nil {
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		dir, _, err := inspectSettingsSkillDirectory(root, slug)
		if errors.Is(err, os.ErrNotExist) {
			return settingsSkillError(c, fiber.StatusNotFound, "Skill 不存在")
		}
		if err != nil {
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		if err := os.RemoveAll(dir); err != nil {
			return settingsSkillError(c, fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"message": "Skill 已删除", "slug": slug})
	}
}
