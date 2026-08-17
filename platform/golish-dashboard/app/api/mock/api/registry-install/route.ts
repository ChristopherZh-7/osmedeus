import { NextResponse } from "next/server";
import { mockDirectBinaries } from "../registry-info/route";

export const dynamic = "force-static";

type RegistryMode = "direct-fetch" | "nix-build";

function uniq(items: string[]): string[] {
  return Array.from(new Set(items));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const type = body?.type;

  if (type === "workflow") {
    const source = typeof body?.source === "string" ? body.source : "";
    return NextResponse.json({
      message: "工作流安装成功",
      source,
      workflow_folder: "/home/user/golish-base/workflow",
    });
  }

  if (type !== "binary") {
    return NextResponse.json(
      { error: true, message: "类型无效" },
      { status: 400 }
    );
  }

  const registry_mode = (typeof body?.registry_mode === "string"
    ? body.registry_mode
    : "direct-fetch") as RegistryMode;

  const installAll = body?.install_all === true;
  const installOptional = body?.install_optional === true;
  const names = Array.isArray(body?.names)
    ? (body?.names as unknown[]).filter((n) => typeof n === "string")
    : [];

  const targets = installAll
    ? Object.keys(mockDirectBinaries).filter((name) => {
        if (installOptional) return true;
        return !Boolean(mockDirectBinaries[name]?.optional);
      })
    : (names as string[]);
  const installed: string[] = [];
  const failed: Array<{ name: string; error?: string }> = [];

  for (const name of targets) {
    const meta = mockDirectBinaries[name];
    if (!meta) {
      failed.push({ name, error: "未找到" });
      continue;
    }
    meta.installed = true;
    meta.path =
      registry_mode === "nix-build"
        ? `/home/user/.nix-profile/bin/${name}`
        : `/usr/local/bin/${name}`;
    installed.push(name);
  }

  const installedUnique = uniq(installed);

  return NextResponse.json({
    message:
      registry_mode === "nix-build"
        ? "Nix 二进制工具安装完成"
        : "二进制工具安装完成",
    registry_mode,
    installed: installedUnique,
    installed_count: installedUnique.length,
    binaries_folder: "/home/user/golish-base/binaries",
    failed,
    failed_count: failed.length,
  });
}
