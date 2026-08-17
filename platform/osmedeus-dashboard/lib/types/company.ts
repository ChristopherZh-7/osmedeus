export type CompanyVerificationStatus = "draft" | "confirmed" | string;

export interface CompanyProfile {
  uuid: string;
  org_uuid?: string;
  input_name: string;
  canonical_name: string;
  short_name?: string;
  aliases?: string[];
  country?: string;
  region?: string;
  registration_number?: string;
  unified_credit_code?: string;
  official_website?: string;
  confidence: number;
  verification_status: CompanyVerificationStatus;
  sources?: string[];
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyDomain {
  id: number;
  company_uuid: string;
  domain: string;
  relation: string;
  ownership_status: string;
  authorization_status: string;
  confidence: number;
  sources?: string[];
  workspace_name?: string;
}

export interface CompanyAssetCandidate {
  id: number;
  company_uuid: string;
  domain?: string;
  provider: string;
  asset_value: string;
  url?: string;
  ip?: string;
  port?: number;
  protocol?: string;
  title?: string;
  asset_type?: string;
  confidence: number;
  ownership_status: string;
  authorization_status: string;
}

export interface CompanyBundle {
  profile: CompanyProfile;
  domains: CompanyDomain[];
  candidates?: CompanyAssetCandidate[];
}

export interface CompanyProviderReport {
  id: string;
  configured: boolean;
  query?: string;
  count: number;
  error?: string;
}
