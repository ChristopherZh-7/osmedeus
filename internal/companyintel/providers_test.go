package companyintel

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/j3ssie/osmedeus/v5/internal/config"
	"github.com/j3ssie/osmedeus/v5/internal/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFOFAProviderNormalizesCandidates(t *testing.T) {
	var capturedQuery string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "operator@example.com", r.URL.Query().Get("email"))
		assert.Equal(t, "secret-key", r.URL.Query().Get("key"))
		raw, err := base64.StdEncoding.DecodeString(r.URL.Query().Get("qbase64"))
		require.NoError(t, err)
		capturedQuery = string(raw)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"error":false,"results":[["https://portal.acme.com","203.0.113.10",443,"https","Portal","portal.acme.com"]]}`))
	}))
	defer server.Close()

	cfg := &config.Config{GlobalVars: config.GlobalVarsConfig{
		"FOFA_EMAIL":    {Value: "operator@example.com"},
		"FOFA_API_KEY":  {Value: "secret-key"},
		"FOFA_BASE_URL": {Value: server.URL},
	}}
	items, query, err := (client{http: server.Client()}).fofa(context.Background(), cfg, "company-1", discoveryScope{domains: []string{"acme.com"}, names: []string{"Acme Technology Co., Ltd."}})
	require.NoError(t, err)
	assert.Equal(t, query, capturedQuery)
	require.Len(t, items, 1)
	assert.Equal(t, "portal.acme.com", items[0].Domain)
	assert.Equal(t, "https://portal.acme.com", items[0].AssetValue)
	assert.Equal(t, "203.0.113.10", items[0].IP)
	assert.Equal(t, 443, items[0].Port)
	assert.Equal(t, "fofa", items[0].Provider)
	assert.Contains(t, query, `domain="acme.com"`)
	assert.Contains(t, query, `cert.subject.org="Acme Technology Co., Ltd."`)
}

func TestDiscoverSkipsUnconfiguredProviders(t *testing.T) {
	result := Discover(context.Background(), &config.Config{}, database.CompanyProfile{UUID: "company-1", CanonicalName: "Acme"}, nil)
	assert.Empty(t, result.Candidates)
	require.Len(t, result.Reports, 4)
	for _, report := range result.Reports {
		assert.False(t, report.Configured)
		assert.Empty(t, report.Error)
	}
}

func TestSafeErrorRedactsCredentials(t *testing.T) {
	message := safeError(assert.AnError, "secret-key")
	assert.NotContains(t, message, "secret-key")
	message = safeError(&testError{"request https://api.test/?key=secret-key failed"}, "secret-key")
	assert.NotContains(t, message, "secret-key")
	assert.Contains(t, message, "[REDACTED]")
}

func TestNormalizeRootDomain(t *testing.T) {
	got, err := NormalizeRootDomain("https://portal.example.co.uk/path")
	require.NoError(t, err)
	assert.Equal(t, "example.co.uk", got)
	_, err = NormalizeRootDomain("localhost")
	assert.Error(t, err)
}

func TestDiscoverySeedDomainsDoesNotExpandProviderCandidates(t *testing.T) {
	domains := []database.CompanyDomain{
		{Domain: "operator.example", Relation: "declared", AuthorizationStatus: database.CompanyAuthorizationPending},
		{Domain: "false-positive.example", Relation: "provider-candidate", AuthorizationStatus: database.CompanyAuthorizationPending},
		{Domain: "authorized.example", Relation: "provider-candidate", AuthorizationStatus: database.CompanyAuthorizationApproved},
	}

	draftSeeds := discoverySeedDomains(database.CompanyProfile{VerificationStatus: database.CompanyVerificationDraft}, domains)
	assert.Equal(t, []string{"operator.example"}, draftSeeds)

	confirmedSeeds := discoverySeedDomains(database.CompanyProfile{VerificationStatus: database.CompanyVerificationConfirmed}, domains)
	assert.Equal(t, []string{"authorized.example"}, confirmedSeeds)
}

func TestDiscoveryQueriesIncludeCompanyIdentityHints(t *testing.T) {
	scope := discoveryScope{domains: []string{"acme.example"}, names: []string{"Acme Technology Co., Ltd."}}
	assert.Equal(t, `domain="acme.example" || cert.subject.org="Acme Technology Co., Ltd." || title="Acme Technology Co., Ltd."`, fofaDiscoveryQuery(scope))
	assert.Equal(t, `domain:"acme.example" || service.http.title:"Acme Technology Co., Ltd."`, quakeDiscoveryQuery(scope))
	assert.Equal(t, `domain.suffix="acme.example" || web.title="Acme Technology Co., Ltd."`, hunterDiscoveryQuery(scope))
}

func TestCompanySearchTermsKeepsPrimaryShortChineseNameAsLead(t *testing.T) {
	terms := companySearchTerms(database.CompanyProfile{CanonicalName: "小米", InputName: "小米", Aliases: []string{"米", "小米科技有限责任公司"}})
	assert.Equal(t, []string{"小米", "小米科技有限责任公司"}, terms)
}

type testError struct{ value string }

func (e *testError) Error() string { return strings.TrimSpace(e.value) }
