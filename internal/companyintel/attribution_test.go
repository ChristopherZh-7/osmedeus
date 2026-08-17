package companyintel

import (
	"testing"

	"github.com/ChristopherZh-7/golish-pentest-platform/v5/internal/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAttributeCandidatesSeparatesOwnershipFromAuthorization(t *testing.T) {
	company := database.CompanyProfile{
		CanonicalName:      "Acme Technology Co., Ltd.",
		VerificationStatus: database.CompanyVerificationConfirmed,
	}
	domains := []database.CompanyDomain{{Domain: "acme.example", AuthorizationStatus: database.CompanyAuthorizationApproved}}
	candidates := []database.CompanyAssetCandidate{{
		Provider: "fofa", Domain: "portal.acme.example", IP: "203.0.113.10", AssetValue: "https://portal.acme.example",
		RawData: map[string]interface{}{"is_cdn": true, "title": "Acme customer portal"},
	}}

	result := AttributeCandidates(company, domains, candidates)
	require.Len(t, result, 1)
	assert.Equal(t, AttributionStrong, result[0].AttributionStatus)
	assert.True(t, result[0].AuthorizationEligible)
	assert.True(t, result[0].SharedInfrastructure)
	assert.Equal(t, "shared-hosting", result[0].InfrastructureType)
	assert.Equal(t, "acme.example", result[0].MatchedRootDomain)
	assert.Contains(t, result[0].AttributionReasons, "检测到 CDN/WAF/公有云等共享基础设施，IP 不视为公司自有")
}

func TestAttributeCandidatesKeepsCompanyNameHitAsUnscopedLead(t *testing.T) {
	company := database.CompanyProfile{CanonicalName: "Acme Technology Co., Ltd.", VerificationStatus: database.CompanyVerificationDraft}
	candidates := []database.CompanyAssetCandidate{{
		Provider: "zerozone", Domain: "possible.example", AssetValue: "https://possible.example",
		RawData: map[string]interface{}{"company": "Acme Technology Co., Ltd.", "title": "Acme Technology"},
	}}

	result := AttributeCandidates(company, nil, candidates)
	require.Len(t, result, 1)
	assert.Equal(t, AttributionProbable, result[0].AttributionStatus)
	assert.False(t, result[0].AuthorizationEligible)
	assert.Empty(t, result[0].MatchedRootDomain)
}

func TestAttributeCandidatesDoesNotClaimSharedBareIP(t *testing.T) {
	company := database.CompanyProfile{CanonicalName: "Acme Technology Co., Ltd.", VerificationStatus: database.CompanyVerificationConfirmed}
	candidates := []database.CompanyAssetCandidate{{
		Provider: "quake", IP: "203.0.113.20", AssetValue: "203.0.113.20", AssetType: "ip",
		RawData: map[string]interface{}{"is_cdn": 1, "organization": "Cloudflare, Inc."},
	}}

	result := AttributeCandidates(company, nil, candidates)
	require.Len(t, result, 1)
	assert.Equal(t, AttributionUnverified, result[0].AttributionStatus)
	assert.False(t, result[0].AuthorizationEligible)
	assert.True(t, result[0].SharedInfrastructure)
}

func TestAttributeCandidatesMarksMatchingNetworkOrgWithoutAuthorizingBareIP(t *testing.T) {
	company := database.CompanyProfile{CanonicalName: "Acme Technology Co., Ltd.", VerificationStatus: database.CompanyVerificationConfirmed}
	candidates := []database.CompanyAssetCandidate{{
		Provider: "fofa", IP: "203.0.113.21", AssetValue: "203.0.113.21", AssetType: "ip",
		RawData: map[string]interface{}{"asn_org": "Acme Technology Co., Ltd."},
	}}

	result := AttributeCandidates(company, nil, candidates)
	require.Len(t, result, 1)
	assert.Equal(t, AttributionWeak, result[0].AttributionStatus)
	assert.Equal(t, "dedicated-ip-candidate", result[0].InfrastructureType)
	assert.False(t, result[0].AuthorizationEligible)
	assert.Contains(t, result[0].AttributionReasons, "网络组织或运营主体字段与公司名称一致")
}

func TestAttributeCandidatesRewardsIndependentProviders(t *testing.T) {
	company := database.CompanyProfile{CanonicalName: "Acme Technology Co., Ltd.", VerificationStatus: database.CompanyVerificationDraft}
	candidates := []database.CompanyAssetCandidate{
		{Provider: "fofa", Domain: "possible.example", IP: "203.0.113.30", Port: 443, AssetValue: "https://possible.example", RawData: map[string]interface{}{"title": "Acme Technology Co., Ltd."}},
		{Provider: "quake", Domain: "possible.example", IP: "203.0.113.30", Port: 443, AssetValue: "possible.example:443", RawData: map[string]interface{}{"title": "Acme Technology Co., Ltd."}},
	}

	result := AttributeCandidates(company, nil, candidates)
	require.Len(t, result, 2)
	for _, candidate := range result {
		assert.Equal(t, AttributionWeak, candidate.AttributionStatus)
		assert.Equal(t, 30, candidate.Confidence)
		assert.Contains(t, candidate.AttributionReasons, "由 2 个独立测绘平台共同发现")
	}
}
