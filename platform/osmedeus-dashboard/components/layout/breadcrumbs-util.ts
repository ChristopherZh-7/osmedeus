import {
  BarChartBigIcon,
  FolderOpenIcon,
  FlowerIcon,
  ScanSearchIcon,
  SettingsIcon,
  DatabaseIcon,
  ClipboardCheckIcon,
  ScrollText as ScrollTextIcon,
  SquareFunction as SquareFunctionIcon,
  Package as PackageIcon,
  ShieldAlertIcon,
  BrainIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { ComponentType } from "react";

export type Crumb = {
  href?: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  isCurrent?: boolean;
};

function titleCase(input: string) {
  const labels: Record<string, string> = {
    dashboard: "控制台",
    assets: "资产",
    inventory: "资产中心",
    orgs: "组织",
    workspaces: "工作区",
    artifacts: "产物",
    vulnerabilities: "漏洞",
    workflows: "工作流",
    "workflows-editor": "工作流编辑器",
    upload: "上传",
    scans: "扫描任务",
    new: "新建扫描",
    schedules: "计划任务",
    events: "事件日志",
    utilities: "实用函数",
    registry: "工具仓库",
    settings: "设置",
    llm: "大模型调试台",
    "agent-pentest": "智能渗透",
  };
  if (labels[input]) return labels[input];
  return input
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function segmentIcon(segment: string): ComponentType<{ className?: string }> | undefined {
  if (segment === "") return BarChartBigIcon;
  if (segment === "assets") return FolderOpenIcon;
  if (segment === "inventory") return DatabaseIcon;
  if (segment === "workflows") return FlowerIcon;
  if (segment === "scans") return ScanSearchIcon;
  if (segment === "settings") return SettingsIcon;
  if (segment === "schedules") return ClipboardCheckIcon;
  if (segment === "events") return ScrollTextIcon;
  if (segment === "vulnerabilities") return ShieldAlertIcon;
  if (segment === "utilities") return SquareFunctionIcon;
  if (segment === "registry") return PackageIcon;
  if (segment === "llm") return BrainIcon;
  if (segment === "agent-pentest") return ShieldCheckIcon;
  return undefined;
}

export function getBreadcrumbs(pathname: string): Crumb[] {
  const path = pathname || "/";
  if (path === "/") {
    return [{ label: "控制台", icon: BarChartBigIcon, isCurrent: true }];
  }
  const parts = path.replace(/^\/+/, "").split("/");
  if (path.startsWith("/inventory")) {
    const icon = segmentIcon("inventory");
    const last = parts[parts.length - 1] || "Inventory";
    return [{ label: titleCase(last), icon, isCurrent: true }];
  }
  const crumbs: Crumb[] = [];
  let acc = "";
  parts.forEach((part, idx) => {
    acc += `/${part}`;
    const isLast = idx === parts.length - 1;
    const icon = idx === 0 ? segmentIcon(part) : undefined;
    const label = isLast ? titleCase(part) : titleCase(part);
    crumbs.push({
      href: isLast ? undefined : acc,
      label,
      icon: isLast ? segmentIcon(parts[0]) : icon,
      isCurrent: isLast,
    });
  });
  return crumbs;
}
