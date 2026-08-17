import { http } from "./http";
import { API_PREFIX } from "@/lib/api/prefix";

// Settings must remain reachable while demo mode is enabled, otherwise the
// operator cannot inspect the real configuration or turn demo mode back off.
const liveSettingsRequest = {
  headers: { "X-Osmedeus-Use-Live-API": "true" },
};

export interface SettingsLLMProvider {
  provider: string;
  base_url: string;
  model: string;
  auth_configured: boolean;
}

export interface ProductSettings {
  version: string;
  llm: {
    configured: boolean;
    providers: SettingsLLMProvider[];
    enabled_tool_call: boolean;
    max_tokens: number;
    temperature: number;
    top_k: number;
    top_p: number;
    max_retries: number;
    timeout: string;
    stream: boolean;
    structured_json_format: boolean;
  };
  agent_harness: {
    enabled: boolean;
    provider: string;
    base_url: string;
    web_ui_enabled: boolean;
    public_url: string;
  };
  scan_tactic: {
    aggressive: number;
    default: number;
    gently: number;
  };
  integrations: Array<{
    id: string;
    label: string;
    configured: boolean;
  }>;
  system: {
    base_folder: string;
    database_engine: string;
    redis_configured: boolean;
    storage_configured: boolean;
    notification_enabled: boolean;
    cloud_enabled: boolean;
    hot_reload_enabled: boolean;
  };
}

export interface SettingsSkill {
  slug: string;
  name: string;
  description: string;
  kind: "coding" | "pentest" | string;
  source: string;
  status: "available" | "loaded" | string;
  references?: number;
  editable: boolean;
}

export interface SettingsSkillDetail extends SettingsSkill {
  content: string;
}

export interface SettingsSkills {
  coding: SettingsSkill[];
  pentest: SettingsSkill[];
  total: number;
}

export interface UpdateAISettingsInput {
  providers: Array<{
    provider: string;
    base_url: string;
    model: string;
    auth_token: string;
    keep_auth_token: boolean;
  }>;
  enabled_tool_call: boolean;
  max_tokens: number;
  temperature: number;
  top_k: number;
  top_p: number;
  max_retries: number;
  timeout: string;
  stream: boolean;
  structured_json_format: boolean;
}

export async function getProductSettings(): Promise<ProductSettings> {
  const response = await http.get(`${API_PREFIX}/settings/product`, liveSettingsRequest);
  return response.data as ProductSettings;
}

export async function getSettingsSkills(): Promise<SettingsSkills> {
  const response = await http.get(`${API_PREFIX}/settings/skills`, liveSettingsRequest);
  return response.data as SettingsSkills;
}

export async function getSettingsSkill(slug: string): Promise<SettingsSkillDetail> {
  const response = await http.get(`${API_PREFIX}/settings/skills/${encodeURIComponent(slug)}`, liveSettingsRequest);
  return response.data as SettingsSkillDetail;
}

export async function createSettingsSkill(input: { slug: string; content: string }): Promise<SettingsSkillDetail> {
  const response = await http.post(`${API_PREFIX}/settings/skills`, input, liveSettingsRequest);
  return response.data as SettingsSkillDetail;
}

export async function updateSettingsSkill(slug: string, input: { content: string }): Promise<SettingsSkillDetail> {
  const response = await http.put(`${API_PREFIX}/settings/skills/${encodeURIComponent(slug)}`, input, liveSettingsRequest);
  return response.data as SettingsSkillDetail;
}

export async function deleteSettingsSkill(slug: string): Promise<void> {
  await http.delete(`${API_PREFIX}/settings/skills/${encodeURIComponent(slug)}`, liveSettingsRequest);
}

export async function updateAISettings(input: UpdateAISettingsInput): Promise<void> {
  await http.put(`${API_PREFIX}/settings/ai`, input, liveSettingsRequest);
}

export async function getSettingsYaml(): Promise<string> {
  const response = await http.get(`${API_PREFIX}/settings/yaml`, {
    ...liveSettingsRequest,
    responseType: "text",
  });
  return response.data as string;
}

export async function reloadSettings(): Promise<void> {
  await http.post(`${API_PREFIX}/settings/reload`, undefined, liveSettingsRequest);
}
