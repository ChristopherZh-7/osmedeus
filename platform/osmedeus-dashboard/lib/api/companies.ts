import { http } from "./http";
import { API_PREFIX } from "@/lib/api/prefix";
import type { CompanyBundle, CompanyProviderReport } from "@/lib/types/company";

export interface CompanyIntakeInput {
  name: string;
  canonical_name?: string;
  short_name?: string;
  aliases?: string[];
  country?: string;
  region?: string;
  registration_number?: string;
  unified_credit_code?: string;
  official_website?: string;
  domains?: string[];
}

export interface CompanyIntakeResult {
  data: CompanyBundle;
  name_resolution: {
    status: string;
    confidence: number;
    message: string;
  };
}

export async function intakeCompany(input: CompanyIntakeInput): Promise<CompanyIntakeResult> {
  const response = await http.post(`${API_PREFIX}/companies/intake`, input);
  return response.data as CompanyIntakeResult;
}

export async function fetchCompanies(): Promise<CompanyBundle[]> {
  const response = await http.get(`${API_PREFIX}/companies`);
  const payload = response.data as { data?: CompanyBundle[] };
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function discoverCompany(uuid: string): Promise<{ data: CompanyBundle; providers: CompanyProviderReport[]; stored: number }> {
  const response = await http.post(`${API_PREFIX}/companies/${encodeURIComponent(uuid)}/discover`);
  return response.data as { data: CompanyBundle; providers: CompanyProviderReport[]; stored: number };
}

export async function confirmCompany(uuid: string, input: { canonical_name: string; domains: string[] }): Promise<{ data: CompanyBundle; created: { org_uuid: string; workspaces: string[] }; scan_started: boolean }> {
  const response = await http.post(`${API_PREFIX}/companies/${encodeURIComponent(uuid)}/confirm`, input);
  return response.data as { data: CompanyBundle; created: { org_uuid: string; workspaces: string[] }; scan_started: boolean };
}

export async function authorizeCompanyCandidates(uuid: string, candidateIds: number[]): Promise<{ data: CompanyBundle; imported: number; scan_started: boolean }> {
  const response = await http.post(`${API_PREFIX}/companies/${encodeURIComponent(uuid)}/candidates/authorize`, { candidate_ids: candidateIds });
  return response.data as { data: CompanyBundle; imported: number; scan_started: boolean };
}

export async function startCompanyRecon(uuid: string, profile: "lite" | "standard" | "extensive" = "standard"): Promise<{ job_id: string; target_count: number; targets: string[]; workflow: string; execution_workflow: string }> {
  const response = await http.post(`${API_PREFIX}/runs`, {
    flow: "company-recon",
    target: uuid,
    concurrency: 2,
    params: { profile },
  });
  return response.data as { job_id: string; target_count: number; targets: string[]; workflow: string; execution_workflow: string };
}
