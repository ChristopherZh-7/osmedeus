package companyintel

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/j3ssie/osmedeus/v5/internal/config"
	"github.com/j3ssie/osmedeus/v5/internal/database"
	"github.com/j3ssie/osmedeus/v5/internal/heuristics"
)

type ProviderReport struct {
	ID         string `json:"id"`
	Configured bool   `json:"configured"`
	Query      string `json:"query,omitempty"`
	Count      int    `json:"count"`
	Error      string `json:"error,omitempty"`
}

type DiscoveryResult struct {
	Candidates []database.CompanyAssetCandidate `json:"candidates"`
	Reports    []ProviderReport                 `json:"providers"`
}

type client struct {
	http *http.Client
}

type discoveryScope struct {
	domains []string
	names   []string
}

func Discover(ctx context.Context, cfg *config.Config, company database.CompanyProfile, domains []database.CompanyDomain) DiscoveryResult {
	c := client{http: &http.Client{Timeout: 25 * time.Second}}
	result := DiscoveryResult{Candidates: []database.CompanyAssetCandidate{}, Reports: []ProviderReport{}}
	scope := buildDiscoveryScope(company, domains)

	providers := []struct {
		id         string
		configured bool
		secrets    []string
		fn         func(context.Context) ([]database.CompanyAssetCandidate, string, error)
	}{
		{id: "fofa", configured: value(cfg, "FOFA_API_KEY") != "" && value(cfg, "FOFA_EMAIL") != "", secrets: []string{value(cfg, "FOFA_API_KEY"), value(cfg, "FOFA_EMAIL")}, fn: func(ctx context.Context) ([]database.CompanyAssetCandidate, string, error) {
			return c.fofa(ctx, cfg, company.UUID, scope)
		}},
		{id: "quake", configured: value(cfg, "QUAKE_API_KEY") != "", secrets: []string{value(cfg, "QUAKE_API_KEY")}, fn: func(ctx context.Context) ([]database.CompanyAssetCandidate, string, error) {
			return c.quake(ctx, cfg, company.UUID, scope)
		}},
		{id: "hunter", configured: value(cfg, "HUNTER_API_KEY") != "", secrets: []string{value(cfg, "HUNTER_API_KEY")}, fn: func(ctx context.Context) ([]database.CompanyAssetCandidate, string, error) {
			return c.hunter(ctx, cfg, company.UUID, scope)
		}},
		{id: "zerozone", configured: value(cfg, "ZEROZONE_API_KEY") != "", secrets: []string{value(cfg, "ZEROZONE_API_KEY")}, fn: func(ctx context.Context) ([]database.CompanyAssetCandidate, string, error) {
			return c.zeroZone(ctx, cfg, company, scope)
		}},
	}

	for _, provider := range providers {
		report := ProviderReport{ID: provider.id, Configured: provider.configured}
		if !provider.configured {
			result.Reports = append(result.Reports, report)
			continue
		}
		items, query, err := provider.fn(ctx)
		report.Query = query
		if err != nil {
			report.Error = safeError(err, provider.secrets...)
		} else {
			items = deduplicate(items)
			report.Count = len(items)
			result.Candidates = append(result.Candidates, items...)
		}
		result.Reports = append(result.Reports, report)
	}
	result.Candidates = AttributeCandidates(company, domains, deduplicate(result.Candidates))
	return result
}

func (c client) fofa(ctx context.Context, cfg *config.Config, companyUUID string, scope discoveryScope) ([]database.CompanyAssetCandidate, string, error) {
	query := fofaDiscoveryQuery(scope)
	if query == "" {
		return nil, "", nil
	}
	endpoint := defaultValue(cfg, "FOFA_BASE_URL", "https://fofa.info/api/v1/search/all")
	u, err := url.Parse(endpoint)
	if err != nil {
		return nil, query, err
	}
	params := u.Query()
	params.Set("email", value(cfg, "FOFA_EMAIL"))
	params.Set("key", value(cfg, "FOFA_API_KEY"))
	params.Set("qbase64", base64.StdEncoding.EncodeToString([]byte(query)))
	params.Set("fields", "host,ip,port,protocol,title,domain,icp,cert.subject.org,org")
	params.Set("size", "1000")
	u.RawQuery = params.Encode()
	var payload struct {
		Error   bool            `json:"error"`
		Message string          `json:"errmsg"`
		Results [][]interface{} `json:"results"`
	}
	if err := c.doJSON(ctx, http.MethodGet, u.String(), nil, nil, &payload); err != nil {
		return nil, query, err
	}
	if payload.Error {
		return nil, query, fmt.Errorf("provider rejected query: %s", payload.Message)
	}
	items := make([]database.CompanyAssetCandidate, 0, len(payload.Results))
	for _, row := range payload.Results {
		fields := make([]string, 9)
		for i := range row {
			if i < len(fields) {
				fields[i] = stringify(row[i])
			}
		}
		raw := map[string]interface{}{
			"row": row, "host": fields[0], "ip": fields[1], "port": fields[2], "protocol": fields[3],
			"title": fields[4], "domain": fields[5], "icp": fields[6], "cert_subject_org": fields[7],
			"asn_org": fields[8],
		}
		candidate := buildCandidate(companyUUID, "fofa", fields[0], fields[1], parseInt(fields[2]), fields[3], fields[4], fields[5], raw)
		if candidate.AssetValue != "" {
			items = append(items, candidate)
		}
	}
	return items, query, nil
}

func (c client) quake(ctx context.Context, cfg *config.Config, companyUUID string, scope discoveryScope) ([]database.CompanyAssetCandidate, string, error) {
	query := quakeDiscoveryQuery(scope)
	if query == "" {
		return nil, "", nil
	}
	body := map[string]interface{}{"query": query, "start": 0, "size": 1000, "ignore_cache": false}
	headers := map[string]string{"X-QuakeToken": value(cfg, "QUAKE_API_KEY")}
	endpoint := defaultValue(cfg, "QUAKE_BASE_URL", "https://quake.360.net/api/v3/search/quake_service")
	var payload interface{}
	if err := c.doJSON(ctx, http.MethodPost, endpoint, body, headers, &payload); err != nil {
		return nil, query, err
	}
	return candidatesFromPayload(companyUUID, "quake", payload), query, nil
}

func (c client) hunter(ctx context.Context, cfg *config.Config, companyUUID string, scope discoveryScope) ([]database.CompanyAssetCandidate, string, error) {
	query := hunterDiscoveryQuery(scope)
	if query == "" {
		return nil, "", nil
	}
	endpoint := defaultValue(cfg, "HUNTER_BASE_URL", "https://hunter.qianxin.com/openApi/search")
	u, err := url.Parse(endpoint)
	if err != nil {
		return nil, query, err
	}
	params := u.Query()
	params.Set("api-key", value(cfg, "HUNTER_API_KEY"))
	params.Set("search", base64.RawURLEncoding.EncodeToString([]byte(query)))
	params.Set("page", "1")
	params.Set("page_size", "100")
	params.Set("is_web", "3")
	u.RawQuery = params.Encode()
	var payload interface{}
	if err := c.doJSON(ctx, http.MethodGet, u.String(), nil, nil, &payload); err != nil {
		return nil, query, err
	}
	return candidatesFromPayload(companyUUID, "hunter", payload), query, nil
}

func (c client) zeroZone(ctx context.Context, cfg *config.Config, company database.CompanyProfile, scope discoveryScope) ([]database.CompanyAssetCandidate, string, error) {
	query := strings.TrimSpace(company.CanonicalName)
	if query == "" {
		query = strings.TrimSpace(company.InputName)
	}
	if query == "" && len(scope.domains) > 0 {
		query = strings.Join(scope.domains, " OR ")
	}
	if query == "" {
		return nil, "", nil
	}
	body := map[string]interface{}{"query": query, "query_type": "site", "page": 1, "pagesize": 100, "zone_key_id": value(cfg, "ZEROZONE_API_KEY"), "is_suspected_site": 1}
	endpoint := defaultValue(cfg, "ZEROZONE_BASE_URL", "https://0.zone/api/data/")
	var payload interface{}
	if err := c.doJSON(ctx, http.MethodPost, endpoint, body, nil, &payload); err != nil {
		return nil, query, err
	}
	return candidatesFromPayload(company.UUID, "zerozone", payload), query, nil
}

func (c client) doJSON(ctx context.Context, method, endpoint string, body interface{}, headers map[string]string, out interface{}) error {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for key, val := range headers {
		req.Header.Set(key, val)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("provider returned HTTP %d", resp.StatusCode)
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("invalid provider JSON: %w", err)
	}
	return nil
}

func candidatesFromPayload(companyUUID, provider string, payload interface{}) []database.CompanyAssetCandidate {
	items := make([]database.CompanyAssetCandidate, 0)
	var walk func(interface{})
	walk = func(value interface{}) {
		switch typed := value.(type) {
		case []interface{}:
			for _, child := range typed {
				walk(child)
			}
		case map[string]interface{}:
			candidate := candidateFromMap(companyUUID, provider, typed)
			if candidate.AssetValue != "" {
				items = append(items, candidate)
			}
			for _, key := range []string{"data", "arr", "list", "items", "results", "records"} {
				if child, ok := typed[key]; ok {
					walk(child)
				}
			}
		}
	}
	walk(payload)
	return deduplicate(items)
}

func candidateFromMap(companyUUID, provider string, raw map[string]interface{}) database.CompanyAssetCandidate {
	urlValue := firstString(raw, "url", "link", "web_url")
	domain := firstString(raw, "domain", "host", "hostname")
	ip := firstString(raw, "ip", "ip_address")
	port := firstInt(raw, "port")
	protocol := firstString(raw, "protocol", "scheme", "service")
	title := firstString(raw, "title", "web_title")
	if nested, ok := raw["service"].(map[string]interface{}); ok {
		if protocol == "" {
			protocol = firstString(nested, "name", "protocol")
		}
		if httpData, ok := nested["http"].(map[string]interface{}); ok {
			if title == "" {
				title = firstString(httpData, "title")
			}
			if domain == "" {
				domain = firstString(httpData, "host", "domain")
			}
		}
	}
	return buildCandidate(companyUUID, provider, urlValue, ip, port, protocol, title, domain, raw)
}

func buildCandidate(companyUUID, provider, rawURL, ip string, port int, protocol, title, domain string, raw map[string]interface{}) database.CompanyAssetCandidate {
	rawURL = strings.TrimSpace(rawURL)
	domain = normalizeHost(domain)
	if rawURL != "" {
		if info, err := heuristics.ParseURL(rawURL); err == nil {
			if domain == "" {
				domain = info.Host
			}
			if protocol == "" {
				protocol = info.Scheme
			}
			if port == 0 {
				port = parseInt(info.Port)
			}
		}
	}
	if domain == "" && net.ParseIP(ip) == nil {
		domain = normalizeHost(ip)
		if domain != "" {
			ip = ""
		}
	}
	assetValue := rawURL
	assetType := "url"
	if assetValue == "" {
		assetValue = domain
		assetType = "dns"
	}
	if assetValue == "" {
		assetValue = ip
		assetType = "ip"
	}
	if assetValue != "" && port > 0 && rawURL == "" {
		assetValue = fmt.Sprintf("%s:%d", assetValue, port)
		assetType = "port"
	}
	return database.CompanyAssetCandidate{CompanyUUID: companyUUID, Domain: domain, Provider: provider, AssetValue: assetValue, URL: rawURL, IP: strings.TrimSpace(ip), Port: port, Protocol: strings.TrimSpace(protocol), Title: strings.TrimSpace(title), AssetType: assetType, Confidence: 50, RawData: raw}
}

func NormalizeRootDomain(input string) (string, error) {
	input = strings.TrimSpace(input)
	if input == "" {
		return "", fmt.Errorf("domain is empty")
	}
	info, err := heuristics.ParseURL(input)
	if err != nil || info.RootDomain == "" || net.ParseIP(info.RootDomain) != nil || !strings.Contains(info.RootDomain, ".") {
		return "", fmt.Errorf("invalid root domain %q", input)
	}
	return strings.ToLower(info.RootDomain), nil
}

// discoverySeedDomains deliberately prevents passive-provider candidates from
// becoming query roots on later discovery runs. Drafts may use only domains
// supplied by the operator; confirmed companies may use only authorized roots.
func discoverySeedDomains(company database.CompanyProfile, domains []database.CompanyDomain) []string {
	result := make([]string, 0, len(domains))
	for _, domain := range domains {
		if company.VerificationStatus == database.CompanyVerificationConfirmed {
			if domain.AuthorizationStatus == database.CompanyAuthorizationApproved {
				result = append(result, domain.Domain)
			}
			continue
		}
		if domain.Relation != "provider-candidate" && domain.AuthorizationStatus != database.CompanyAuthorizationExcluded {
			result = append(result, domain.Domain)
		}
	}
	return compact(result)
}

func buildDiscoveryScope(company database.CompanyProfile, domains []database.CompanyDomain) discoveryScope {
	return discoveryScope{
		domains: discoverySeedDomains(company, domains),
		names:   companySearchTerms(company),
	}
}

func companySearchTerms(company database.CompanyProfile) []string {
	values := []string{company.CanonicalName, company.InputName, company.ShortName}
	values = append(values, company.Aliases...)
	// Keep provider queries bounded. Full legal names rank first; very short
	// brands are excluded from generic title searches because they explode the
	// false-positive and quota cost.
	candidates := compactPreservingCase(values, 0)
	result := make([]string, 0, 4)
	for index, candidate := range candidates {
		length := len([]rune(normalizeEvidenceText(candidate)))
		// Always allow the primary operator-supplied name as a discovery hint,
		// including short Chinese brands such as 小米 or 腾讯. Short aliases are
		// omitted; and the attribution scorer still refuses to treat a short
		// title match as proof of ownership.
		if length < 2 || (index > 0 && length < 4) {
			continue
		}
		result = append(result, candidate)
		if len(result) == 4 {
			break
		}
	}
	return result
}

func compactPreservingCase(values []string, max int) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, item := range values {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		key := strings.ToLower(item)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, item)
		if max > 0 && len(result) >= max {
			break
		}
	}
	return result
}

func fofaDiscoveryQuery(scope discoveryScope) string {
	clauses := make([]string, 0, len(scope.domains)+len(scope.names)*2)
	for _, domain := range scope.domains {
		clauses = append(clauses, fmt.Sprintf(`domain="%s"`, escapeQueryValue(domain)))
	}
	for _, name := range scope.names {
		escaped := escapeQueryValue(name)
		clauses = append(clauses, fmt.Sprintf(`cert.subject.org="%s"`, escaped), fmt.Sprintf(`title="%s"`, escaped))
	}
	return strings.Join(clauses, " || ")
}

func quakeDiscoveryQuery(scope discoveryScope) string {
	clauses := make([]string, 0, len(scope.domains)+len(scope.names))
	for _, domain := range scope.domains {
		clauses = append(clauses, fmt.Sprintf(`domain:"%s"`, escapeQueryValue(domain)))
	}
	for _, name := range scope.names {
		clauses = append(clauses, fmt.Sprintf(`service.http.title:"%s"`, escapeQueryValue(name)))
	}
	return strings.Join(clauses, " || ")
}

func hunterDiscoveryQuery(scope discoveryScope) string {
	clauses := make([]string, 0, len(scope.domains)+len(scope.names))
	for _, domain := range scope.domains {
		clauses = append(clauses, fmt.Sprintf(`domain.suffix="%s"`, escapeQueryValue(domain)))
	}
	for _, name := range scope.names {
		clauses = append(clauses, fmt.Sprintf(`web.title="%s"`, escapeQueryValue(name)))
	}
	return strings.Join(clauses, " || ")
}

func escapeQueryValue(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	return strings.ReplaceAll(value, `"`, `\"`)
}

func normalizeHost(input string) string {
	input = strings.TrimSpace(strings.ToLower(input))
	if input == "" {
		return ""
	}
	if strings.Contains(input, "://") {
		if parsed, err := url.Parse(input); err == nil {
			return parsed.Hostname()
		}
	}
	input = strings.TrimPrefix(input, "*.")
	input = strings.TrimSuffix(input, ".")
	if host, _, err := net.SplitHostPort(input); err == nil {
		return host
	}
	return input
}

func deduplicate(items []database.CompanyAssetCandidate) []database.CompanyAssetCandidate {
	seen := make(map[string]struct{}, len(items))
	result := make([]database.CompanyAssetCandidate, 0, len(items))
	for _, item := range items {
		key := item.CompanyUUID + "\x00" + item.Provider + "\x00" + item.AssetValue
		if item.AssetValue == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, item)
	}
	return result
}

func compact(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, item := range values {
		item = strings.ToLower(strings.TrimSpace(item))
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}
	return result
}

func value(cfg *config.Config, key string) string {
	if cfg == nil {
		return ""
	}
	val, _ := cfg.GetGlobalVar(key)
	return strings.TrimSpace(val)
}

func defaultValue(cfg *config.Config, key, fallback string) string {
	if val := value(cfg, key); val != "" {
		return val
	}
	return fallback
}

func safeError(err error, secrets ...string) string {
	message := err.Error()
	for _, secret := range secrets {
		if secret != "" {
			message = strings.ReplaceAll(message, secret, "[REDACTED]")
		}
	}
	return message
}

func firstString(raw map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := raw[key]; ok {
			if text := stringify(value); text != "" && text != "<nil>" && text != "map[]" {
				return text
			}
		}
	}
	return ""
}

func firstInt(raw map[string]interface{}, keys ...string) int {
	for _, key := range keys {
		if value, ok := raw[key]; ok {
			if parsed := parseInt(stringify(value)); parsed != 0 {
				return parsed
			}
		}
	}
	return 0
}

func stringify(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	case json.Number:
		return typed.String()
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case int:
		return strconv.Itoa(typed)
	default:
		return strings.TrimSpace(fmt.Sprint(value))
	}
}

func parseInt(value string) int {
	parsed, _ := strconv.Atoi(strings.TrimSpace(strings.Split(value, ".")[0]))
	return parsed
}
