package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

const (
	CompanyVerificationDraft     = "draft"
	CompanyVerificationConfirmed = "confirmed"

	CompanyOwnershipCandidate = "candidate"
	CompanyOwnershipConfirmed = "confirmed"

	CompanyAuthorizationPending  = "pending"
	CompanyAuthorizationApproved = "approved"
	CompanyAuthorizationExcluded = "excluded"
)

var ErrCompanyNotFound = errors.New("company not found")

type CompanyBundle struct {
	Profile    CompanyProfile          `json:"profile"`
	Domains    []CompanyDomain         `json:"domains"`
	Candidates []CompanyAssetCandidate `json:"candidates,omitempty"`
}

type CompanyDraftInput struct {
	InputName          string
	CanonicalName      string
	ShortName          string
	Aliases            []string
	Country            string
	Region             string
	RegistrationNumber string
	UnifiedCreditCode  string
	OfficialWebsite    string
	Confidence         int
	Sources            []string
	RawEvidence        map[string]interface{}
	Domains            []CompanyDomain
}

func CreateCompanyDraft(ctx context.Context, input CompanyDraftInput) (*CompanyBundle, error) {
	if db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	input.InputName = strings.TrimSpace(input.InputName)
	input.CanonicalName = strings.TrimSpace(input.CanonicalName)
	if input.InputName == "" {
		return nil, fmt.Errorf("company input name cannot be empty")
	}
	if input.CanonicalName == "" {
		input.CanonicalName = input.InputName
	}
	if input.Confidence < 0 || input.Confidence > 100 {
		return nil, fmt.Errorf("company confidence must be between 0 and 100")
	}

	now := time.Now()
	profile := CompanyProfile{
		UUID:               uuid.New().String(),
		InputName:          input.InputName,
		CanonicalName:      input.CanonicalName,
		ShortName:          strings.TrimSpace(input.ShortName),
		Aliases:            compactStrings(input.Aliases),
		Country:            strings.TrimSpace(input.Country),
		Region:             strings.TrimSpace(input.Region),
		RegistrationNumber: strings.TrimSpace(input.RegistrationNumber),
		UnifiedCreditCode:  strings.TrimSpace(input.UnifiedCreditCode),
		OfficialWebsite:    strings.TrimSpace(input.OfficialWebsite),
		Confidence:         input.Confidence,
		VerificationStatus: CompanyVerificationDraft,
		Sources:            compactStrings(input.Sources),
		RawEvidence:        input.RawEvidence,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	err := Transaction(ctx, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(&profile).Exec(ctx); err != nil {
			return fmt.Errorf("create company profile: %w", err)
		}
		for i := range input.Domains {
			domain := &input.Domains[i]
			domain.CompanyUUID = profile.UUID
			domain.Domain = strings.ToLower(strings.TrimSpace(domain.Domain))
			if domain.Domain == "" {
				continue
			}
			if domain.Relation == "" {
				domain.Relation = "candidate"
			}
			if domain.OwnershipStatus == "" {
				domain.OwnershipStatus = CompanyOwnershipCandidate
			}
			if domain.AuthorizationStatus == "" {
				domain.AuthorizationStatus = CompanyAuthorizationPending
			}
			domain.CreatedAt, domain.UpdatedAt = now, now
			if _, err := tx.NewInsert().Model(domain).
				On("CONFLICT (company_uuid, domain) DO UPDATE").
				Set("confidence = CASE WHEN EXCLUDED.confidence > confidence THEN EXCLUDED.confidence ELSE confidence END").
				Set("sources = EXCLUDED.sources").
				Set("updated_at = EXCLUDED.updated_at").
				Exec(ctx); err != nil {
				return fmt.Errorf("create company domain %s: %w", domain.Domain, err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return GetCompanyBundle(ctx, profile.UUID)
}

func GetCompanyBundle(ctx context.Context, companyUUID string) (*CompanyBundle, error) {
	if db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	bundle := new(CompanyBundle)
	err := db.NewSelect().Model(&bundle.Profile).Where("uuid = ?", companyUUID).Scan(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("%w: %s", ErrCompanyNotFound, companyUUID)
	}
	if err != nil {
		return nil, err
	}
	if err := db.NewSelect().Model(&bundle.Domains).
		Where("company_uuid = ?", companyUUID).Order("confidence DESC", "domain ASC").Scan(ctx); err != nil {
		return nil, err
	}
	if err := db.NewSelect().Model(&bundle.Candidates).
		Where("company_uuid = ?", companyUUID).Order("created_at DESC").Scan(ctx); err != nil {
		return nil, err
	}
	return bundle, nil
}

func ListCompanyBundles(ctx context.Context) ([]CompanyBundle, error) {
	var profiles []CompanyProfile
	if err := db.NewSelect().Model(&profiles).Order("updated_at DESC").Scan(ctx); err != nil {
		return nil, err
	}
	result := make([]CompanyBundle, 0, len(profiles))
	for _, profile := range profiles {
		bundle, err := GetCompanyBundle(ctx, profile.UUID)
		if err != nil {
			return nil, err
		}
		result = append(result, *bundle)
	}
	return result, nil
}

func UpsertCompanyDomain(ctx context.Context, domain *CompanyDomain) error {
	if domain == nil || strings.TrimSpace(domain.CompanyUUID) == "" || strings.TrimSpace(domain.Domain) == "" {
		return fmt.Errorf("company and domain are required")
	}
	domain.Domain = strings.ToLower(strings.TrimSpace(domain.Domain))
	if domain.Relation == "" {
		domain.Relation = "candidate"
	}
	if domain.OwnershipStatus == "" {
		domain.OwnershipStatus = CompanyOwnershipCandidate
	}
	if domain.AuthorizationStatus == "" {
		domain.AuthorizationStatus = CompanyAuthorizationPending
	}
	now := time.Now()
	if domain.CreatedAt.IsZero() {
		domain.CreatedAt = now
	}
	domain.UpdatedAt = now
	_, err := db.NewInsert().Model(domain).
		On("CONFLICT (company_uuid, domain) DO UPDATE").
		Set("relation = EXCLUDED.relation").
		Set("confidence = CASE WHEN EXCLUDED.confidence > confidence THEN EXCLUDED.confidence ELSE confidence END").
		Set("sources = EXCLUDED.sources").
		Set("evidence = EXCLUDED.evidence").
		Set("updated_at = EXCLUDED.updated_at").
		Exec(ctx)
	return err
}

func UpsertCompanyAssetCandidates(ctx context.Context, candidates []CompanyAssetCandidate) (int, error) {
	if len(candidates) == 0 {
		return 0, nil
	}
	now := time.Now()
	for i := range candidates {
		candidate := &candidates[i]
		candidate.Domain = strings.ToLower(strings.TrimSpace(candidate.Domain))
		candidate.Provider = strings.ToLower(strings.TrimSpace(candidate.Provider))
		candidate.AssetValue = strings.TrimSpace(candidate.AssetValue)
		if candidate.CompanyUUID == "" || candidate.Provider == "" || candidate.AssetValue == "" {
			return 0, fmt.Errorf("candidate company, provider and asset value are required")
		}
		if candidate.OwnershipStatus == "" {
			candidate.OwnershipStatus = CompanyOwnershipCandidate
		}
		if candidate.AuthorizationStatus == "" {
			candidate.AuthorizationStatus = CompanyAuthorizationPending
		}
		if candidate.AttributionStatus == "" {
			candidate.AttributionStatus = "unverified"
		}
		if candidate.InfrastructureType == "" {
			candidate.InfrastructureType = "unknown"
		}
		candidate.CreatedAt, candidate.UpdatedAt = now, now
	}
	res, err := db.NewInsert().Model(&candidates).
		On("CONFLICT (company_uuid, provider, asset_value) DO UPDATE").
		Set("domain = EXCLUDED.domain").
		Set("url = EXCLUDED.url").
		Set("ip = EXCLUDED.ip").
		Set("port = EXCLUDED.port").
		Set("protocol = EXCLUDED.protocol").
		Set("title = EXCLUDED.title").
		Set("asset_type = EXCLUDED.asset_type").
		Set("confidence = EXCLUDED.confidence").
		Set("attribution_status = EXCLUDED.attribution_status").
		Set("attribution_reasons = EXCLUDED.attribution_reasons").
		Set("matched_root_domain = EXCLUDED.matched_root_domain").
		Set("infrastructure_type = EXCLUDED.infrastructure_type").
		Set("shared_infrastructure = EXCLUDED.shared_infrastructure").
		Set("authorization_eligible = EXCLUDED.authorization_eligible").
		Set("raw_data = EXCLUDED.raw_data").
		Set("updated_at = EXCLUDED.updated_at").
		Exec(ctx)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// ConfirmCompany converts a draft into an org and creates workspaces only for
// the explicitly selected domains.
func ConfirmCompany(ctx context.Context, companyUUID, canonicalName, workspacesRoot string, selectedDomains []string) (*CompanyBundle, error) {
	canonicalName = strings.TrimSpace(canonicalName)
	selectedDomains = compactStringsLower(selectedDomains)
	if len(selectedDomains) == 0 {
		return nil, fmt.Errorf("at least one authorized domain is required")
	}

	err := Transaction(ctx, func(ctx context.Context, tx bun.Tx) error {
		profile := new(CompanyProfile)
		if err := tx.NewSelect().Model(profile).Where("uuid = ?", companyUUID).Scan(ctx); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return fmt.Errorf("%w: %s", ErrCompanyNotFound, companyUUID)
			}
			return err
		}
		if canonicalName == "" {
			canonicalName = profile.CanonicalName
		}
		if canonicalName == "" {
			return fmt.Errorf("canonical company name is required")
		}

		org := new(Org)
		err := tx.NewSelect().Model(org).Where("LOWER(name) = LOWER(?)", canonicalName).Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			now := time.Now()
			org = &Org{UUID: uuid.New().String(), Name: canonicalName, Description: "公司档案：" + profile.InputName, Tags: []string{"company"}, CreatedAt: now, UpdatedAt: now}
			if _, err := tx.NewInsert().Model(org).Exec(ctx); err != nil {
				return fmt.Errorf("create company org: %w", err)
			}
		} else if err != nil {
			return err
		}
		if org.IsDefault() {
			return fmt.Errorf("the default org cannot be used as a company identity")
		}

		var knownDomains []CompanyDomain
		if err := tx.NewSelect().Model(&knownDomains).Where("company_uuid = ?", companyUUID).Scan(ctx); err != nil {
			return err
		}
		known := make(map[string]*CompanyDomain, len(knownDomains))
		for i := range knownDomains {
			known[knownDomains[i].Domain] = &knownDomains[i]
		}

		now := time.Now()
		for _, domainName := range selectedDomains {
			domain := known[domainName]
			if domain == nil {
				domain = &CompanyDomain{CompanyUUID: companyUUID, Domain: domainName, Relation: "confirmed", Confidence: 100, Sources: []string{"operator"}, CreatedAt: now}
			}
			domain.Relation = "confirmed"
			domain.OwnershipStatus = CompanyOwnershipConfirmed
			domain.AuthorizationStatus = CompanyAuthorizationApproved
			domain.Confidence = 100
			domain.Sources = compactStrings(append(domain.Sources, "operator"))
			domain.Evidence = "操作员已确认该根域属于公司授权范围"
			domain.WorkspaceName = domainName
			domain.UpdatedAt = now
			if domain.ID == 0 {
				if _, err := tx.NewInsert().Model(domain).Exec(ctx); err != nil {
					return err
				}
			} else if _, err := tx.NewUpdate().Model(domain).Column("relation", "ownership_status", "authorization_status", "confidence", "sources", "evidence", "workspace_name", "updated_at").WherePK().Exec(ctx); err != nil {
				return err
			}

			existing := new(Workspace)
			err := tx.NewSelect().Model(existing).Where("name = ?", domainName).Scan(ctx)
			if err == nil && existing.OrgUUID != "" && existing.OrgUUID != DefaultOrgUUID && existing.OrgUUID != org.UUID {
				return fmt.Errorf("workspace %s already belongs to another org", domainName)
			}
			if err != nil && !errors.Is(err, sql.ErrNoRows) {
				return err
			}
			localPath := strings.TrimRight(workspacesRoot, "/\\")
			if localPath != "" {
				localPath += "/" + domainName
			}
			workspace := &Workspace{Name: domainName, OrgUUID: org.UUID, LocalPath: localPath, DataSource: "company-intake", Tags: []string{"company", "authorized"}, CreatedAt: now, UpdatedAt: now}
			if _, err := tx.NewInsert().Model(workspace).
				On("CONFLICT (name) DO UPDATE").
				Set("org_uuid = EXCLUDED.org_uuid").
				Set("local_path = CASE WHEN local_path = '' THEN EXCLUDED.local_path ELSE local_path END").
				Set("data_source = EXCLUDED.data_source").
				Set("updated_at = EXCLUDED.updated_at").Exec(ctx); err != nil {
				return err
			}
			asset := &Asset{Workspace: domainName, OrgUUID: org.UUID, AssetValue: domainName, Input: domainName, AssetType: "dns", Source: "company-intake", Remarks: []string{"authorized-root-domain"}, CreatedAt: now, UpdatedAt: now, LastSeenAt: now}
			if _, err := tx.NewInsert().Model(asset).
				On("CONFLICT (workspace, asset_value, url) DO UPDATE").
				Set("org_uuid = EXCLUDED.org_uuid").
				Set("source = EXCLUDED.source").
				Set("updated_at = EXCLUDED.updated_at").Exec(ctx); err != nil {
				return err
			}
		}

		profile.OrgUUID = org.UUID
		profile.CanonicalName = canonicalName
		profile.VerificationStatus = CompanyVerificationConfirmed
		profile.ConfirmedAt = &now
		profile.UpdatedAt = now
		if _, err := tx.NewUpdate().Model(profile).Column("org_uuid", "canonical_name", "verification_status", "confirmed_at", "updated_at").WherePK().Exec(ctx); err != nil {
			return err
		}
		invalidateWorkspaceOrgCache()
		return nil
	})
	if err != nil {
		return nil, err
	}
	return GetCompanyBundle(ctx, companyUUID)
}

// AuthorizeCompanyCandidates imports selected passive candidates into the
// workspace that owns their confirmed root domain.
func AuthorizeCompanyCandidates(ctx context.Context, companyUUID string, candidateIDs []int64) (int, error) {
	if len(candidateIDs) == 0 {
		return 0, fmt.Errorf("no candidate ids given")
	}
	imported := 0
	err := Transaction(ctx, func(ctx context.Context, tx bun.Tx) error {
		profile := new(CompanyProfile)
		if err := tx.NewSelect().Model(profile).Where("uuid = ? AND verification_status = ?", companyUUID, CompanyVerificationConfirmed).Scan(ctx); err != nil {
			return fmt.Errorf("company must be confirmed before assets are authorized: %w", err)
		}
		var domains []CompanyDomain
		if err := tx.NewSelect().Model(&domains).Where("company_uuid = ? AND authorization_status = ?", companyUUID, CompanyAuthorizationApproved).Scan(ctx); err != nil {
			return err
		}
		var candidates []CompanyAssetCandidate
		if err := tx.NewSelect().Model(&candidates).Where("company_uuid = ? AND id IN (?)", companyUUID, bun.In(candidateIDs)).Scan(ctx); err != nil {
			return err
		}
		if len(candidates) != len(uniqueInt64s(candidateIDs)) {
			return fmt.Errorf("one or more company candidates do not exist")
		}
		for i := range candidates {
			candidate := &candidates[i]
			workspace := authorizedWorkspaceFor(candidate.Domain, domains)
			if workspace == "" {
				return fmt.Errorf("candidate %d domain %q is outside authorized company domains", candidate.ID, candidate.Domain)
			}
			raw, _ := json.Marshal(candidate.RawData)
			now := time.Now()
			asset := &Asset{Workspace: workspace, OrgUUID: profile.OrgUUID, AssetValue: candidate.AssetValue, URL: candidate.URL, Input: candidate.Domain, HostIP: candidate.IP, Title: candidate.Title, AssetType: candidate.AssetType, Source: "company-provider:" + candidate.Provider, RawJsonData: string(raw), CreatedAt: now, UpdatedAt: now, LastSeenAt: now}
			if candidate.Port > 0 {
				asset.OpenPorts = []string{fmt.Sprintf("%d/tcp", candidate.Port)}
			}
			if _, err := tx.NewInsert().Model(asset).
				On("CONFLICT (workspace, asset_value, url) DO UPDATE").
				Set("org_uuid = EXCLUDED.org_uuid").
				Set("host_ip = CASE WHEN EXCLUDED.host_ip != '' THEN EXCLUDED.host_ip ELSE host_ip END").
				Set("title = CASE WHEN EXCLUDED.title != '' THEN EXCLUDED.title ELSE title END").
				Set("source = EXCLUDED.source").
				Set("raw_json_data = EXCLUDED.raw_json_data").
				Set("updated_at = EXCLUDED.updated_at").Exec(ctx); err != nil {
				return err
			}
			candidate.AuthorizationStatus = CompanyAuthorizationApproved
			candidate.OwnershipStatus = CompanyOwnershipConfirmed
			candidate.UpdatedAt = now
			if _, err := tx.NewUpdate().Model(candidate).Column("authorization_status", "ownership_status", "updated_at").WherePK().Exec(ctx); err != nil {
				return err
			}
			imported++
		}
		return nil
	})
	return imported, err
}

func authorizedWorkspaceFor(domain string, approved []CompanyDomain) string {
	domain = strings.ToLower(strings.TrimSpace(domain))
	for _, item := range approved {
		if domain == item.Domain || strings.HasSuffix(domain, "."+item.Domain) {
			return item.WorkspaceName
		}
	}
	return ""
}

func compactStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func compactStringsLower(values []string) []string {
	for i := range values {
		values[i] = strings.ToLower(values[i])
	}
	return compactStrings(values)
}

func uniqueInt64s(values []int64) []int64 {
	seen := make(map[int64]struct{}, len(values))
	result := make([]int64, 0, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
