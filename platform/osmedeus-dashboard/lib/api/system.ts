import { isDemoMode } from "./demo-mode";
import { http, getHttpBaseURL } from "./http";

export interface ServerInfo {
  message: string;
  version: string;
  repo?: string;
  author?: string;
  docs?: string;
  license?: string;
}

const DEMO_SERVER_INFO: ServerInfo = {
  message: "演示模式",
  version: "demo",
  license: "open-source",
};

export async function getServerInfo(): Promise<ServerInfo> {
  if (isDemoMode()) return DEMO_SERVER_INFO;
  const baseURL = getHttpBaseURL();
  if (!baseURL) {
    throw new Error("0:API endpoint not configured");
  }
  const res = await http.get("/server-info");
  return res.data as ServerInfo;
}
