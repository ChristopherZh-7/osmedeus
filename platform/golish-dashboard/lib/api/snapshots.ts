import { http } from "./http";
import { API_PREFIX } from "@/lib/api/prefix";
import { isDemoMode } from "./demo-mode";

export async function downloadSnapshot(workspace: string): Promise<Blob> {
  if (isDemoMode()) {
    return new Blob([
      JSON.stringify(
        {
          workspace,
          message: "演示模式：快照下载为模拟操作",
          created_at: new Date().toISOString(),
        },
        null,
        2
      ),
    ], { type: "application/json" });
  }
  const res = await http.get(`${API_PREFIX}/snapshot-download/${encodeURIComponent(workspace)}`, {
    responseType: "blob",
  });
  return res.data as Blob;
}
