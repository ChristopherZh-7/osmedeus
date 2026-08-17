"use client";

import * as React from "react";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentScans } from "@/components/dashboard/recent-scans";
import { StatCardSkeleton } from "@/components/shared/loading-skeleton";
import { fetchDashboardStats } from "@/lib/api/stats";
import { formatNumber } from "@/lib/utils";
import type { DashboardStats } from "@/lib/types/asset";
import {
  WorkflowIcon,
  FolderOpenIcon,
  GlobeIcon,
  LinkIcon,
  AlertTriangleIcon,
} from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetchDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to load stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div className="space-y-4">

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))
        ) : stats ? (
          <>
            <StatCard
              title="工作流"
              value={formatNumber(stats.workflows)}
              icon={WorkflowIcon}
              description="可用工作流模块"
            />
            <StatCard
              title="工作区"
              value={formatNumber(stats.workspaces)}
              icon={FolderOpenIcon}
              description="目标工作区"
            />
            <StatCard
              title="子域名"
              value={formatNumber(stats.subdomains)}
              icon={GlobeIcon}
              description="已发现的子域名"
            />
            <StatCard
              title="HTTP 资产"
              value={formatNumber(stats.httpAssets)}
              icon={LinkIcon}
              description="可访问的 Web 端点"
            />
            <StatCard
              title="漏洞"
              value={formatNumber(stats.vulnerabilities)}
              icon={AlertTriangleIcon}
              description="安全问题"
            />
          </>
        ) : null}
      </div>

      {/* Recent Scans */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentScans />

        {/* Quick Actions Card */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">快捷操作</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/scans/new"
              className="flex items-center gap-3 rounded-card border border-border p-4 transition-colors duration-150 hover:bg-sunken"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary-soft">
                <svg
                  className="size-5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium">新建扫描</p>
                <p className="text-sm text-muted-foreground">
                  启动新的安全扫描
                </p>
              </div>
            </Link>

            <Link
              href="/assets"
              className="flex items-center gap-3 rounded-card border border-border p-4 transition-colors duration-150 hover:bg-sunken"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary-soft">
                <FolderOpenIcon className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">查看资产</p>
                <p className="text-sm text-muted-foreground">
                  浏览已发现的资产
                </p>
              </div>
            </Link>

            <Link
              href="/workflows-editor"
              className="flex items-center gap-3 rounded-card border border-border p-4 transition-colors duration-150 hover:bg-sunken"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary-soft">
                <WorkflowIcon className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">编辑工作流</p>
                <p className="text-sm text-muted-foreground">
                  自定义扫描工作流
                </p>
              </div>
            </Link>

            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-card border border-border p-4 transition-colors duration-150 hover:bg-sunken"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary-soft">
                <svg
                  className="size-5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium">设置</p>
                <p className="text-sm text-muted-foreground">
                  配置偏好设置
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
