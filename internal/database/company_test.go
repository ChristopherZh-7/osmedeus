package database

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompanyIntakeConfirmAndAuthorizeClosedLoop(t *testing.T) {
	cleanup := setupOrgTestDB(t)
	defer cleanup()
	ctx := context.Background()

	draft, err := CreateCompanyDraft(ctx, CompanyDraftInput{
		InputName:     "Acme",
		CanonicalName: "Acme Technology Co., Ltd.",
		Confidence:    70,
		Domains:       []CompanyDomain{{Domain: "acme.example", Relation: "official", Confidence: 90}},
	})
	require.NoError(t, err)
	assert.Empty(t, draft.Profile.OrgUUID)
	assert.Equal(t, CompanyVerificationDraft, draft.Profile.VerificationStatus)

	orgs, err := ListOrgs(ctx)
	require.NoError(t, err)
	require.Len(t, orgs, 1, "draft intake must not create an org")
	workspaceCount, err := db.NewSelect().Model((*Workspace)(nil)).Count(ctx)
	require.NoError(t, err)
	assert.Zero(t, workspaceCount, "draft intake must not create a workspace")

	confirmed, err := ConfirmCompany(ctx, draft.Profile.UUID, "Acme Technology Co., Ltd.", filepath.Join(t.TempDir(), "workspaces"), []string{"acme.example"})
	require.NoError(t, err)
	assert.NotEmpty(t, confirmed.Profile.OrgUUID)
	assert.Equal(t, CompanyVerificationConfirmed, confirmed.Profile.VerificationStatus)
	require.Len(t, confirmed.Domains, 1)
	assert.Equal(t, CompanyAuthorizationApproved, confirmed.Domains[0].AuthorizationStatus)
	assert.Equal(t, CompanyOwnershipConfirmed, confirmed.Domains[0].OwnershipStatus)
	assert.Equal(t, "confirmed", confirmed.Domains[0].Relation)
	assert.Equal(t, 100, confirmed.Domains[0].Confidence)
	assert.Equal(t, "操作员已确认该根域属于公司授权范围", confirmed.Domains[0].Evidence)

	workspace := new(Workspace)
	require.NoError(t, db.NewSelect().Model(workspace).Where("name = ?", "acme.example").Scan(ctx))
	assert.Equal(t, confirmed.Profile.OrgUUID, workspace.OrgUUID)
	assert.Equal(t, "company-intake", workspace.DataSource)
	asset := new(Asset)
	require.NoError(t, db.NewSelect().Model(asset).Where("workspace = ? AND asset_value = ?", "acme.example", "acme.example").Scan(ctx))
	assert.Equal(t, confirmed.Profile.OrgUUID, asset.OrgUUID)

	stored, err := UpsertCompanyAssetCandidates(ctx, []CompanyAssetCandidate{
		{CompanyUUID: draft.Profile.UUID, Domain: "portal.acme.example", Provider: "fofa", AssetValue: "https://portal.acme.example", URL: "https://portal.acme.example", AssetType: "url", Confidence: 85, AttributionStatus: "strong", AttributionReasons: []string{"域名位于已授权根域范围内"}, MatchedRootDomain: "acme.example", InfrastructureType: "domain-associated-ip", AuthorizationEligible: true},
		{CompanyUUID: draft.Profile.UUID, Domain: "unrelated.example", Provider: "fofa", AssetValue: "https://unrelated.example", URL: "https://unrelated.example", AssetType: "url"},
	})
	require.NoError(t, err)
	assert.Equal(t, 2, stored)

	updated, err := GetCompanyBundle(ctx, draft.Profile.UUID)
	require.NoError(t, err)
	require.Len(t, updated.Candidates, 2)
	ids := map[string]int64{}
	for _, candidate := range updated.Candidates {
		ids[candidate.Domain] = candidate.ID
		if candidate.Domain == "portal.acme.example" {
			assert.Equal(t, "strong", candidate.AttributionStatus)
			assert.Equal(t, []string{"域名位于已授权根域范围内"}, candidate.AttributionReasons)
			assert.Equal(t, "acme.example", candidate.MatchedRootDomain)
			assert.True(t, candidate.AuthorizationEligible)
		}
	}

	imported, err := AuthorizeCompanyCandidates(ctx, draft.Profile.UUID, []int64{ids["portal.acme.example"]})
	require.NoError(t, err)
	assert.Equal(t, 1, imported)
	count, err := db.NewSelect().Model((*Asset)(nil)).Where("workspace = ? AND asset_value = ?", "acme.example", "https://portal.acme.example").Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, count)

	_, err = AuthorizeCompanyCandidates(ctx, draft.Profile.UUID, []int64{ids["unrelated.example"]})
	require.ErrorContains(t, err, "outside authorized company domains")
	count, err = db.NewSelect().Model((*Asset)(nil)).Where("asset_value = ?", "https://unrelated.example").Count(ctx)
	require.NoError(t, err)
	assert.Zero(t, count)
}

func TestConfirmCompanyRejectsWorkspaceOwnedByAnotherOrg(t *testing.T) {
	cleanup := setupOrgTestDB(t)
	defer cleanup()
	ctx := context.Background()

	other, err := CreateOrg(ctx, "other", "", "", nil)
	require.NoError(t, err)
	_, err = db.NewInsert().Model(&Workspace{Name: "conflict.example", OrgUUID: other.UUID}).Exec(ctx)
	require.NoError(t, err)
	draft, err := CreateCompanyDraft(ctx, CompanyDraftInput{InputName: "Conflict", CanonicalName: "Conflict Ltd", Domains: []CompanyDomain{{Domain: "conflict.example"}}})
	require.NoError(t, err)

	_, err = ConfirmCompany(ctx, draft.Profile.UUID, "Conflict Ltd", t.TempDir(), []string{"conflict.example"})
	require.ErrorContains(t, err, "already belongs to another org")
	reloaded, err := GetCompanyBundle(ctx, draft.Profile.UUID)
	require.NoError(t, err)
	assert.Equal(t, CompanyVerificationDraft, reloaded.Profile.VerificationStatus, "failed confirmation must roll back")
	_, err = GetOrgByName(ctx, "Conflict Ltd")
	assert.ErrorIs(t, err, ErrOrgNotFound)
}

func TestDeleteOrgReopensCompanyProfile(t *testing.T) {
	cleanup := setupOrgTestDB(t)
	defer cleanup()
	ctx := context.Background()

	draft, err := CreateCompanyDraft(ctx, CompanyDraftInput{
		InputName: "Reopen", CanonicalName: "Reopen Ltd", Domains: []CompanyDomain{{Domain: "reopen.example"}},
	})
	require.NoError(t, err)
	confirmed, err := ConfirmCompany(ctx, draft.Profile.UUID, "Reopen Ltd", t.TempDir(), []string{"reopen.example"})
	require.NoError(t, err)

	require.NoError(t, DeleteOrg(ctx, confirmed.Profile.OrgUUID, false))
	reloaded, err := GetCompanyBundle(ctx, draft.Profile.UUID)
	require.NoError(t, err)
	assert.Empty(t, reloaded.Profile.OrgUUID)
	assert.Equal(t, CompanyVerificationDraft, reloaded.Profile.VerificationStatus)
	assert.Nil(t, reloaded.Profile.ConfirmedAt)
}
