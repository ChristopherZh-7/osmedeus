"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChartBigIcon,
  ScanSearchIcon,
  WorkflowIcon,
  FolderOpenIcon,
  SettingsIcon,
  ClipboardCheckIcon,
  ScrollText as ScrollTextIcon,
  SquareFunction as SquareFunctionIcon,
  Package as PackageIcon,
  ArchiveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShieldAlertIcon,
  DatabaseIcon,
  BrainIcon,
  Building as BuildingIcon,
  ShieldCheck as ShieldCheckIcon,
} from "lucide-react";
import { isDemoMode } from "@/lib/api/demo-mode";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navigationGroups = [
  {
    label: "概览",
    items: [
      {
        name: "统计概览",
        href: "/",
        icon: BarChartBigIcon,
      },
    ],
  },
  {
    label: "扫描任务",
    items: [
      {
        name: "扫描任务",
        href: "/scans",
        icon: ScanSearchIcon,
      },
      {
        name: "计划任务",
        href: "/schedules",
        icon: ClipboardCheckIcon,
      },
    ],
  },
  {
    label: "工作流",
    items: [
      {
        name: "工作流",
        href: "/workflows",
        icon: WorkflowIcon,
      },
      {
        name: "事件日志",
        href: "/events",
        icon: ScrollTextIcon,
      },
    ],
  },
  {
    label: "资产中心",
    items: [
      {
        name: "组织",
        href: "/inventory/orgs",
        icon: BuildingIcon,
      },
      {
        name: "工作区",
        href: "/inventory/workspaces",
        icon: FolderOpenIcon,
      },
      {
        name: "资产",
        href: "/inventory/assets",
        icon: DatabaseIcon,
      },
      {
        name: "产物",
        href: "/inventory/artifacts",
        icon: ArchiveIcon,
      },
      {
        name: "漏洞",
        href: "/vulnerabilities",
        icon: ShieldAlertIcon,
      },
    ],
  },
  {
    label: "AI 渗透测试",
    items: [
      {
        name: "智能渗透",
        href: "/agent-pentest",
        icon: ShieldCheckIcon,
      },
    ],
  },
  {
    label: "系统",
    items: [
      {
        name: "实用函数",
        href: "/utilities",
        icon: SquareFunctionIcon,
      },
      {
        name: "大模型调试台",
        href: "/llm",
        icon: BrainIcon,
      },
      {
        name: "工具仓库",
        href: "/registry",
        icon: PackageIcon,
      },
      {
        name: "设置",
        href: "/settings",
        icon: SettingsIcon,
      },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { open, toggleSidebar } = useSidebar();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-7 items-center justify-center">
                  <ShieldCheckIcon className="size-6 text-sidebar-primary" aria-hidden="true" />
                </div>
                <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">安全测试平台</span>
                    {isDemoMode() && (
                      <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                        演示
                      </Badge>
                    )}
                  </div>
                  <span className="text-2xs uppercase tracking-label text-faint">控制台</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navigationGroups.map((group, groupIndex) => (
          <React.Fragment key={group.label}>
            <SidebarGroup>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.name}>
                          <Link href={item.href}>
                            <item.icon className={active ? "text-sidebar-primary" : ""} />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {groupIndex < navigationGroups.length - 1 ? <SidebarSeparator /> : null}
          </React.Fragment>
        ))}
      </SidebarContent>

      <SidebarFooter className="items-center gap-0.5 py-1">
        <Button
          onClick={toggleSidebar}
          variant="ghost"
          size="icon-sm"
          aria-label="切换侧边栏"
        >
          {open ? <ChevronLeftIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
        </Button>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
