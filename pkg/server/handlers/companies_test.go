package handlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/j3ssie/osmedeus/v5/internal/config"
	"github.com/j3ssie/osmedeus/v5/internal/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompanyAPIClosedLoop(t *testing.T) {
	tmp := t.TempDir()
	cfg := &config.Config{
		BaseFolder:     tmp,
		WorkspacesPath: filepath.Join(tmp, "workspaces"),
		Database:       config.DatabaseConfig{DBEngine: "sqlite", DBPath: filepath.Join(tmp, "companies.sqlite")},
	}
	_, err := database.Connect(cfg)
	require.NoError(t, err)
	t.Cleanup(func() { _ = database.Close(); database.SetDB(nil) })
	require.NoError(t, database.Migrate(context.Background()))

	app := fiber.New()
	app.Post("/companies/intake", IntakeCompany(cfg))
	app.Post("/companies/:uuid/discover", DiscoverCompany(cfg))
	app.Post("/companies/:uuid/confirm", ConfirmCompany(cfg))

	intake := postJSON(t, app, "/companies/intake", map[string]interface{}{
		"name": "艾克米", "canonical_name": "艾克米科技有限公司", "official_website": "https://www.acme.com/about", "domains": []string{"acme.cn"},
	}, fiber.StatusCreated)
	data := intake["data"].(map[string]interface{})
	profile := data["profile"].(map[string]interface{})
	uuid := profile["uuid"].(string)
	assert.Empty(t, profile["org_uuid"])
	assert.Equal(t, "draft", profile["verification_status"])
	orgs, err := database.ListOrgs(context.Background())
	require.NoError(t, err)
	require.Len(t, orgs, 1)

	discovered := postJSON(t, app, "/companies/"+uuid+"/discover", nil, fiber.StatusOK)
	reports := discovered["providers"].([]interface{})
	require.Len(t, reports, 4)
	for _, item := range reports {
		assert.False(t, item.(map[string]interface{})["configured"].(bool))
	}
	_, err = database.UpsertCompanyAssetCandidates(context.Background(), []database.CompanyAssetCandidate{{
		CompanyUUID: uuid, Provider: "fofa", Domain: "portal.acme.com", IP: "203.0.113.50",
		AssetValue: "https://portal.acme.com", URL: "https://portal.acme.com",
		RawData: map[string]interface{}{"title": "艾克米科技有限公司客户门户", "is_cdn": true},
	}})
	require.NoError(t, err)

	confirmed := postJSON(t, app, "/companies/"+uuid+"/confirm", map[string]interface{}{
		"canonical_name": "艾克米科技有限公司", "domains": []string{"acme.com", "acme.cn"},
	}, fiber.StatusOK)
	confirmedData := confirmed["data"].(map[string]interface{})
	confirmedProfile := confirmedData["profile"].(map[string]interface{})
	assert.Equal(t, "confirmed", confirmedProfile["verification_status"])
	assert.NotEmpty(t, confirmedProfile["org_uuid"])
	assert.Equal(t, false, confirmed["scan_started"])
	created := confirmed["created"].(map[string]interface{})
	assert.Len(t, created["workspaces"].([]interface{}), 2)

	workspaceCount, err := database.GetDB().NewSelect().Model((*database.Workspace)(nil)).Where("org_uuid = ?", confirmedProfile["org_uuid"]).Count(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 2, workspaceCount)
	assetCount, err := database.GetDB().NewSelect().Model((*database.Asset)(nil)).Where("org_uuid = ?", confirmedProfile["org_uuid"]).Count(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 2, assetCount)
	reloaded, err := database.GetCompanyBundle(context.Background(), uuid)
	require.NoError(t, err)
	require.Len(t, reloaded.Candidates, 1)
	assert.True(t, reloaded.Candidates[0].AuthorizationEligible)
	assert.Equal(t, "acme.com", reloaded.Candidates[0].MatchedRootDomain)
	assert.Equal(t, "strong", reloaded.Candidates[0].AttributionStatus)
	assert.True(t, reloaded.Candidates[0].SharedInfrastructure)

	// The grouped company workflow may expand only the roots an operator
	// explicitly approved; a newly discovered candidate must stay out.
	require.NoError(t, database.UpsertCompanyDomain(context.Background(), &database.CompanyDomain{
		CompanyUUID: uuid, Domain: "candidate.example", Relation: "provider-candidate",
		OwnershipStatus: database.CompanyOwnershipCandidate, AuthorizationStatus: database.CompanyAuthorizationPending,
	}))
	targets, orgUUID, err := resolveCompanyReconTargets(context.Background(), uuid)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"acme.com", "acme.cn"}, targets)
	assert.Equal(t, confirmedProfile["org_uuid"], orgUUID)
}

func TestNormalizeCoreProfile(t *testing.T) {
	params := map[string]string{}
	require.NoError(t, normalizeCoreProfile("domain-recon", params))
	assert.Equal(t, "standard", params["profile"])

	params = map[string]string{"profile": " EXTENSIVE "}
	require.NoError(t, normalizeCoreProfile("company-recon", params))
	assert.Equal(t, "extensive", params["profile"])

	assert.Error(t, normalizeCoreProfile("network-recon", map[string]string{"profile": "maximum"}))
	assert.NoError(t, normalizeCoreProfile("legacy-custom-flow", map[string]string{"profile": "maximum"}))
}

func TestCompanyNameDiscoveryCreatesExplainableUnscopedCandidates(t *testing.T) {
	var query string
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, err := base64.StdEncoding.DecodeString(r.URL.Query().Get("qbase64"))
		require.NoError(t, err)
		query = string(raw)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"error":false,"results":[["https://portal.discovered.example","203.0.113.60",443,"https","Acme Technology Portal","portal.discovered.example","","Acme Technology Co., Ltd.","Cloudflare, Inc.","edge.cloudflare.net"]]}`))
	}))
	defer provider.Close()

	tmp := t.TempDir()
	cfg := &config.Config{
		BaseFolder: tmp, WorkspacesPath: filepath.Join(tmp, "workspaces"),
		Database: config.DatabaseConfig{DBEngine: "sqlite", DBPath: filepath.Join(tmp, "companies.sqlite")},
		GlobalVars: config.GlobalVarsConfig{
			"FOFA_EMAIL": {Value: "operator@example.com"}, "FOFA_API_KEY": {Value: "secret"}, "FOFA_BASE_URL": {Value: provider.URL},
		},
	}
	_, err := database.Connect(cfg)
	require.NoError(t, err)
	t.Cleanup(func() { _ = database.Close(); database.SetDB(nil) })
	require.NoError(t, database.Migrate(context.Background()))

	app := fiber.New()
	app.Post("/companies/intake", IntakeCompany(cfg))
	app.Post("/companies/:uuid/discover", DiscoverCompany(cfg))
	intake := postJSON(t, app, "/companies/intake", map[string]interface{}{
		"name": "Acme Technology", "canonical_name": "Acme Technology Co., Ltd.",
	}, fiber.StatusCreated)
	uuid := intake["data"].(map[string]interface{})["profile"].(map[string]interface{})["uuid"].(string)
	discovered := postJSON(t, app, "/companies/"+uuid+"/discover", nil, fiber.StatusOK)

	assert.Contains(t, query, `cert.subject.org="Acme Technology Co., Ltd."`)
	data := discovered["data"].(map[string]interface{})
	candidates := data["candidates"].([]interface{})
	require.Len(t, candidates, 1)
	candidate := candidates[0].(map[string]interface{})
	assert.Equal(t, false, candidate["authorization_eligible"])
	assert.Equal(t, true, candidate["shared_infrastructure"])
	assert.Equal(t, "shared-hosting", candidate["infrastructure_type"])
	assert.NotEmpty(t, candidate["attribution_reasons"])
	domains := data["domains"].([]interface{})
	require.Len(t, domains, 1)
	assert.Equal(t, "discovered.example", domains[0].(map[string]interface{})["domain"])
	assert.Equal(t, "pending", domains[0].(map[string]interface{})["authorization_status"])
	assert.True(t, strings.Contains(domains[0].(map[string]interface{})["evidence"].(string), "TLS 证书主体组织"))
}

func TestLooksLikeLegalCompanyName(t *testing.T) {
	assert.True(t, looksLikeLegalCompanyName("北京艾克米科技有限公司"))
	assert.True(t, looksLikeLegalCompanyName("Acme Technology Co., Ltd."))
	assert.False(t, looksLikeLegalCompanyName("艾克米"))
	assert.False(t, looksLikeLegalCompanyName("Acme"))
}

func postJSON(t *testing.T, app *fiber.App, path string, payload interface{}, wantStatus int) map[string]interface{} {
	t.Helper()
	var body []byte
	var err error
	if payload != nil {
		body, err = json.Marshal(payload)
		require.NoError(t, err)
	}
	req := httptest.NewRequest("POST", path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, wantStatus, resp.StatusCode, string(raw))
	result := map[string]interface{}{}
	require.NoError(t, json.Unmarshal(raw, &result))
	return result
}
