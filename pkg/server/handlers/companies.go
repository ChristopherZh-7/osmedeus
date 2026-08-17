package handlers

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/j3ssie/osmedeus/v5/internal/companyintel"
	"github.com/j3ssie/osmedeus/v5/internal/config"
	"github.com/j3ssie/osmedeus/v5/internal/database"
)

type companyIntakeRequest struct {
	Name               string                 `json:"name"`
	CanonicalName      string                 `json:"canonical_name"`
	ShortName          string                 `json:"short_name"`
	Aliases            []string               `json:"aliases"`
	Country            string                 `json:"country"`
	Region             string                 `json:"region"`
	RegistrationNumber string                 `json:"registration_number"`
	UnifiedCreditCode  string                 `json:"unified_credit_code"`
	OfficialWebsite    string                 `json:"official_website"`
	Domains            []string               `json:"domains"`
	Sources            []string               `json:"sources"`
	Evidence           map[string]interface{} `json:"evidence"`
}

type companyConfirmRequest struct {
	CanonicalName string   `json:"canonical_name"`
	Domains       []string `json:"domains"`
}

type companyAuthorizeRequest struct {
	CandidateIDs []int64 `json:"candidate_ids"`
}

func ListCompanies(_ *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		companies, err := database.ListCompanyBundles(c.UserContext())
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": err.Error()})
		}
		return c.JSON(fiber.Map{"data": companies, "total": len(companies)})
	}
}

func GetCompany(_ *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		bundle, err := database.GetCompanyBundle(c.UserContext(), c.Params("uuid"))
		if err != nil {
			status := fiber.StatusInternalServerError
			if errors.Is(err, database.ErrCompanyNotFound) {
				status = fiber.StatusNotFound
			}
			return c.Status(status).JSON(fiber.Map{"error": true, "message": err.Error()})
		}
		return c.JSON(fiber.Map{"data": bundle})
	}
}

// IntakeCompany records the operator's evidence as a draft. It never creates
// an org, workspace, asset, or scan run.
func IntakeCompany(_ *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req companyIntakeRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "请求格式无效"})
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "公司名称不能为空"})
		}

		domains := make([]database.CompanyDomain, 0, len(req.Domains)+1)
		seen := map[string]struct{}{}
		appendDomain := func(raw, relation, source string, confidence int) error {
			if strings.TrimSpace(raw) == "" {
				return nil
			}
			domain, err := companyintel.NormalizeRootDomain(raw)
			if err != nil {
				return err
			}
			if _, ok := seen[domain]; ok {
				return nil
			}
			seen[domain] = struct{}{}
			domains = append(domains, database.CompanyDomain{Domain: domain, Relation: relation, OwnershipStatus: database.CompanyOwnershipCandidate, AuthorizationStatus: database.CompanyAuthorizationPending, Confidence: confidence, Sources: []string{source}})
			return nil
		}
		if err := appendDomain(req.OfficialWebsite, "official", "operator:official-website", 90); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "官网地址无效：" + err.Error()})
		}
		for _, raw := range req.Domains {
			if err := appendDomain(raw, "declared", "operator", 70); err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "域名无效：" + err.Error()})
			}
		}

		canonical := strings.TrimSpace(req.CanonicalName)
		confidence := 25
		if canonical == "" {
			canonical = req.Name
		}
		hasRegistryEvidence := strings.TrimSpace(req.RegistrationNumber) != "" || strings.TrimSpace(req.UnifiedCreditCode) != ""
		switch {
		case hasRegistryEvidence && looksLikeLegalCompanyName(canonical):
			confidence = 90
		case hasRegistryEvidence:
			confidence = 75
		case looksLikeLegalCompanyName(canonical):
			confidence = 65
		case strings.TrimSpace(req.CanonicalName) != "":
			confidence = 50
		}
		bundle, err := database.CreateCompanyDraft(c.UserContext(), database.CompanyDraftInput{
			InputName: req.Name, CanonicalName: canonical, ShortName: req.ShortName, Aliases: req.Aliases,
			Country: req.Country, Region: req.Region, RegistrationNumber: req.RegistrationNumber,
			UnifiedCreditCode: req.UnifiedCreditCode, OfficialWebsite: strings.TrimSpace(req.OfficialWebsite),
			Confidence: confidence, Sources: append(req.Sources, "operator"), RawEvidence: req.Evidence, Domains: domains,
		})
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": err.Error()})
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"data": bundle,
			"name_resolution": fiber.Map{
				"status": "needs_confirmation", "confidence": confidence,
				"message": "公司全称必须结合工商登记号、统一社会信用代码或官网证据人工确认；系统不会仅凭相似名称自动开扫。",
			},
		})
	}
}

func looksLikeLegalCompanyName(name string) bool {
	normalized := strings.ToLower(strings.TrimSpace(name))
	if normalized == "" {
		return false
	}
	suffixes := []string{
		"有限责任公司", "股份有限公司", "集团有限公司", "有限公司", "公司",
		" incorporated", " corporation", " limited", " co., ltd.", " co., ltd", " ltd.", " ltd", " inc.", " inc", " llc", " plc",
	}
	for _, suffix := range suffixes {
		if strings.HasSuffix(normalized, suffix) {
			return true
		}
	}
	return false
}

func DiscoverCompany(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		bundle, err := database.GetCompanyBundle(c.UserContext(), c.Params("uuid"))
		if err != nil {
			status := fiber.StatusInternalServerError
			if errors.Is(err, database.ErrCompanyNotFound) {
				status = fiber.StatusNotFound
			}
			return c.Status(status).JSON(fiber.Map{"error": true, "message": err.Error()})
		}
		result := companyintel.Discover(c.UserContext(), cfg, bundle.Profile, bundle.Domains)
		for _, candidate := range result.Candidates {
			if strings.TrimSpace(candidate.Domain) == "" {
				continue
			}
			root, normalizeErr := companyintel.NormalizeRootDomain(candidate.Domain)
			if normalizeErr != nil {
				continue
			}
			if err := database.UpsertCompanyDomain(c.UserContext(), &database.CompanyDomain{
				CompanyUUID: bundle.Profile.UUID, Domain: root, Relation: "provider-candidate",
				OwnershipStatus: database.CompanyOwnershipCandidate, AuthorizationStatus: database.CompanyAuthorizationPending,
				Confidence: 45, Sources: []string{"provider:" + candidate.Provider},
			}); err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": err.Error(), "providers": result.Reports})
			}
		}
		stored, err := database.UpsertCompanyAssetCandidates(c.UserContext(), result.Candidates)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": err.Error(), "providers": result.Reports})
		}
		updated, err := database.GetCompanyBundle(c.UserContext(), bundle.Profile.UUID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": err.Error()})
		}
		return c.JSON(fiber.Map{"data": updated, "providers": result.Reports, "stored": stored})
	}
}

func ConfirmCompany(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req companyConfirmRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "请求格式无效"})
		}
		if len(req.Domains) == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "至少选择一个已获授权的根域名"})
		}
		normalized := make([]string, 0, len(req.Domains))
		for _, raw := range req.Domains {
			domain, err := companyintel.NormalizeRootDomain(raw)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": err.Error()})
			}
			normalized = append(normalized, domain)
			if cfg.WorkspacesPath != "" {
				if err := os.MkdirAll(filepath.Join(cfg.WorkspacesPath, domain), 0755); err != nil {
					return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": fmt.Sprintf("创建工作区目录 %s 失败: %v", domain, err)})
				}
			}
		}
		bundle, err := database.ConfirmCompany(c.UserContext(), c.Params("uuid"), req.CanonicalName, cfg.WorkspacesPath, normalized)
		if err != nil {
			status := fiber.StatusConflict
			if errors.Is(err, database.ErrCompanyNotFound) {
				status = fiber.StatusNotFound
			}
			return c.Status(status).JSON(fiber.Map{"error": true, "message": err.Error()})
		}
		return c.JSON(fiber.Map{"data": bundle, "created": fiber.Map{"org_uuid": bundle.Profile.OrgUUID, "workspaces": normalized}, "scan_started": false})
	}
}

func AuthorizeCompanyCandidates(_ *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req companyAuthorizeRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "请求格式无效"})
		}
		count, err := database.AuthorizeCompanyCandidates(c.UserContext(), c.Params("uuid"), req.CandidateIDs)
		if err != nil {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": true, "message": err.Error()})
		}
		bundle, err := database.GetCompanyBundle(c.UserContext(), c.Params("uuid"))
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": true, "message": err.Error()})
		}
		return c.JSON(fiber.Map{"data": bundle, "imported": count, "scan_started": false})
	}
}
