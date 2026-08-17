package companyintel

import (
	"fmt"
	"net"
	"sort"
	"strconv"
	"strings"
	"unicode"

	"github.com/j3ssie/osmedeus/v5/internal/database"
)

const (
	AttributionStrong     = "strong"
	AttributionProbable   = "probable"
	AttributionWeak       = "weak"
	AttributionUnverified = "unverified"
)

type evidenceValue struct {
	path  string
	value string
}

// AttributeCandidates turns mapping-platform hits into explainable leads. It
// deliberately keeps ownership confidence separate from scan authorization:
// only a hostname under an already-approved root is eligible for import.
func AttributeCandidates(company database.CompanyProfile, domains []database.CompanyDomain, candidates []database.CompanyAssetCandidate) []database.CompanyAssetCandidate {
	knownRoots := discoverySeedDomains(company, domains)
	approvedRoots := make([]string, 0, len(domains))
	for _, domain := range domains {
		if domain.AuthorizationStatus == database.CompanyAuthorizationApproved {
			approvedRoots = append(approvedRoots, domain.Domain)
		}
	}
	approvedRoots = compact(approvedRoots)

	providersByAsset := make(map[string]map[string]struct{}, len(candidates))
	for _, candidate := range candidates {
		key := candidateEvidenceKey(candidate)
		if providersByAsset[key] == nil {
			providersByAsset[key] = make(map[string]struct{})
		}
		providersByAsset[key][candidate.Provider] = struct{}{}
	}

	result := make([]database.CompanyAssetCandidate, len(candidates))
	for i := range candidates {
		result[i] = attributeCandidate(company, knownRoots, approvedRoots, candidates[i], len(providersByAsset[candidateEvidenceKey(candidates[i])]))
	}
	return result
}

func attributeCandidate(company database.CompanyProfile, knownRoots, approvedRoots []string, candidate database.CompanyAssetCandidate, providerCount int) database.CompanyAssetCandidate {
	values := flattenEvidence(candidate.RawData)
	identityTerms := companyIdentityTerms(company)
	registryTerms := compactIdentityTerms([]string{company.RegistrationNumber, company.UnifiedCreditCode})

	score := 5 // A provider hit is a lead, never ownership proof by itself.
	reasons := []string{"测绘平台返回候选，仅作为发现线索"}
	matchedRoot := matchRoot(candidate.Domain, knownRoots)
	approvedRoot := matchRoot(candidate.Domain, approvedRoots)
	if matchedRoot != "" {
		score += 75
		reasons = append(reasons, "域名位于已知根域 "+matchedRoot+" 范围内")
		if strings.EqualFold(candidate.Domain, matchedRoot) {
			score += 10
			reasons = append(reasons, "候选域名与根域完全一致")
		}
	}

	registryMatch := evidenceMatches(values, []string{"icp", "beian", "record", "registration", "credit"}, registryTerms)
	if registryMatch {
		score += 60
		reasons = append(reasons, "备案号或登记标识与公司档案一致")
	}
	registeredNameMatch := evidenceMatches(values, []string{"company", "group", "registrant", "holder", "owner"}, identityTerms)
	if registeredNameMatch {
		score += 55
		reasons = append(reasons, "平台企业/持有人字段与公司名称一致")
	}
	certificateMatch := evidenceMatches(values, []string{"cert_subject_org", "certificate_subject_org", "subject.organization", "subject.org"}, identityTerms)
	if certificateMatch {
		score += 35
		reasons = append(reasons, "TLS 证书主体组织与公司名称一致")
	}
	networkOwnerMatch := evidenceMatches(values, []string{"asn_org", "network_org", "organization", "operator"}, identityTerms)
	if networkOwnerMatch {
		score += 40
		reasons = append(reasons, "网络组织或运营主体字段与公司名称一致")
	}
	titleMatch := evidenceMatches(values, []string{"title"}, identityTerms)
	if titleMatch {
		score += 10
		reasons = append(reasons, "页面标题包含公司身份词（弱证据）")
	}
	if providerCount > 1 {
		score += 15
		reasons = append(reasons, fmt.Sprintf("由 %d 个独立测绘平台共同发现", providerCount))
	}

	shared := detectSharedInfrastructure(values)
	if shared {
		reasons = append(reasons, "检测到 CDN/WAF/公有云等共享基础设施，IP 不视为公司自有")
		if candidate.Domain == "" {
			score -= 40
		}
	}
	if candidate.Domain == "" && net.ParseIP(strings.TrimSpace(candidate.IP)) != nil && !networkOwnerMatch {
		if score > 35 {
			score = 35
		}
		reasons = append(reasons, "裸 IP 缺少公司网段/ASN 归属证据")
	}
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}

	candidate.Confidence = score
	candidate.AttributionStatus = attributionStatus(score)
	candidate.AttributionReasons = compactReasons(reasons)
	candidate.MatchedRootDomain = matchedRoot
	candidate.SharedInfrastructure = shared
	candidate.AuthorizationEligible = company.VerificationStatus == database.CompanyVerificationConfirmed && approvedRoot != ""
	candidate.InfrastructureType = infrastructureType(candidate, shared, networkOwnerMatch)
	if candidate.AuthorizationEligible {
		candidate.AttributionReasons = append(candidate.AttributionReasons, "位于已授权根域，可由操作员审核后导入")
	} else {
		candidate.AttributionReasons = append(candidate.AttributionReasons, "当前不在已授权范围，不允许直接导入或扫描")
	}
	return candidate
}

func attributionStatus(score int) string {
	switch {
	case score >= 80:
		return AttributionStrong
	case score >= 60:
		return AttributionProbable
	case score >= 30:
		return AttributionWeak
	default:
		return AttributionUnverified
	}
}

func infrastructureType(candidate database.CompanyAssetCandidate, shared, networkOwnerMatch bool) string {
	if shared {
		return "shared-hosting"
	}
	if candidate.Domain != "" && candidate.IP != "" {
		return "domain-associated-ip"
	}
	if candidate.Domain != "" {
		return "hostname"
	}
	if candidate.IP != "" && networkOwnerMatch {
		return "dedicated-ip-candidate"
	}
	if candidate.IP != "" {
		return "unattributed-ip"
	}
	return "unknown"
}

func matchRoot(domain string, roots []string) string {
	domain = normalizeHost(domain)
	best := ""
	for _, root := range roots {
		root = normalizeHost(root)
		if domain == root || strings.HasSuffix(domain, "."+root) {
			if len(root) > len(best) {
				best = root
			}
		}
	}
	return best
}

func companyIdentityTerms(company database.CompanyProfile) []string {
	values := []string{company.CanonicalName, company.InputName, company.ShortName}
	values = append(values, company.Aliases...)
	return compactIdentityTerms(values)
}

func compactIdentityTerms(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		normalized := normalizeEvidenceText(value)
		// Very short brands generate too many false positives in titles and
		// banners. They remain query hints but are not attribution evidence.
		if len([]rune(normalized)) < 4 {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}
	return result
}

func normalizeEvidenceText(value string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			return unicode.ToLower(r)
		}
		return -1
	}, value)
}

func evidenceMatches(values []evidenceValue, keyHints, terms []string) bool {
	if len(terms) == 0 {
		return false
	}
	for _, item := range values {
		path := strings.ToLower(item.path)
		matchedKey := false
		for _, hint := range keyHints {
			if strings.Contains(path, hint) {
				matchedKey = true
				break
			}
		}
		if !matchedKey {
			continue
		}
		normalizedValue := normalizeEvidenceText(item.value)
		for _, term := range terms {
			if strings.Contains(normalizedValue, term) {
				return true
			}
		}
	}
	return false
}

func flattenEvidence(raw map[string]interface{}) []evidenceValue {
	result := make([]evidenceValue, 0, 32)
	var walk func(string, interface{}, int)
	walk = func(path string, value interface{}, depth int) {
		if depth > 8 || len(result) >= 512 {
			return
		}
		switch typed := value.(type) {
		case map[string]interface{}:
			keys := make([]string, 0, len(typed))
			for key := range typed {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			for _, key := range keys {
				next := key
				if path != "" {
					next = path + "." + key
				}
				walk(next, typed[key], depth+1)
			}
		case []interface{}:
			for i, child := range typed {
				walk(path+"["+strconv.Itoa(i)+"]", child, depth+1)
			}
		case string:
			if strings.TrimSpace(typed) != "" {
				result = append(result, evidenceValue{path: path, value: typed})
			}
		case bool:
			result = append(result, evidenceValue{path: path, value: strconv.FormatBool(typed)})
		case float64:
			result = append(result, evidenceValue{path: path, value: strconv.FormatFloat(typed, 'f', -1, 64)})
		case int:
			result = append(result, evidenceValue{path: path, value: strconv.Itoa(typed)})
		}
	}
	walk("", raw, 0)
	return result
}

func detectSharedInfrastructure(values []evidenceValue) bool {
	sharedKeywords := []string{
		"cloudflare", "cloudfront", "akamai", "fastly", "amazon", "aws", "azure",
		"googlecloud", "aliyun", "alibabacloud", "tencentcloud", "huaweicloud",
		"阿里云", "腾讯云", "华为云", "网宿", "百度云", "cdn", "waf",
	}
	for _, item := range values {
		path := strings.ToLower(item.path)
		value := strings.ToLower(strings.TrimSpace(item.value))
		if (strings.Contains(path, "is_cdn") || strings.Contains(path, "is_waf") || strings.Contains(path, "is_cloud")) && isTrueish(value) {
			return true
		}
		if !(strings.Contains(path, "org") || strings.Contains(path, "operator") || strings.Contains(path, "cname") || strings.Contains(path, "cdn") || strings.Contains(path, "cloud") || strings.Contains(path, "waf")) {
			continue
		}
		normalized := normalizeEvidenceText(value)
		for _, keyword := range sharedKeywords {
			if strings.Contains(normalized, normalizeEvidenceText(keyword)) {
				return true
			}
		}
	}
	return false
}

func isTrueish(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "cdn", "waf", "cloud":
		return true
	default:
		return false
	}
}

func candidateEvidenceKey(candidate database.CompanyAssetCandidate) string {
	domain := normalizeHost(candidate.Domain)
	ip := strings.ToLower(strings.TrimSpace(candidate.IP))
	if domain != "" || ip != "" {
		return domain + "\x00" + ip + "\x00" + strconv.Itoa(candidate.Port)
	}
	return strings.ToLower(strings.TrimSpace(candidate.AssetValue))
}

func compactReasons(reasons []string) []string {
	seen := make(map[string]struct{}, len(reasons))
	result := make([]string, 0, len(reasons))
	for _, reason := range reasons {
		if _, ok := seen[reason]; ok {
			continue
		}
		seen[reason] = struct{}{}
		result = append(result, reason)
	}
	return result
}
