"use client";

import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatBytes, getStatusBadgeVariant } from "@/lib/utils";
import type { HttpAsset } from "@/lib/types/asset";
import {
  GlobeIcon,
  ServerIcon,
  ShieldIcon,
  CodeIcon,
  ClockIcon,
  ExternalLinkIcon,
} from "lucide-react";

interface AssetDetailDialogProps {
  asset: HttpAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssetDetailDialog({
  asset,
  open,
  onOpenChange,
}: AssetDetailDialogProps) {
  if (!asset) return null;
  const safeUrl = (asset.url ?? "").trim();

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full w-full sm:max-w-2xl">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <GlobeIcon className="size-5" />
            资产详情
          </DrawerTitle>
          <DrawerDescription className="font-mono text-xs break-all">
            {safeUrl || "-"}
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 px-4 pb-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <GlobeIcon className="size-4" />
                概览
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">ID</p>
                  <p className="font-mono text-xs">{asset.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">资产值</p>
                  <p className="font-mono">{asset.assetValue || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">工作区</p>
                  <p>{asset.workspace || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">输入</p>
                  <p className="font-mono text-xs">{asset.input || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">URL</p>
                  <a
                    href={safeUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-primary hover:underline flex items-center gap-1 break-all"
                  >
                    {safeUrl || "-"}
                    <ExternalLinkIcon className="size-3 shrink-0" />
                  </a>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CodeIcon className="size-4" />
                HTTP 请求
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">方法</p>
                  <Badge variant="outline">{asset.method}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">协议</p>
                  <p>{asset.scheme || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">路径</p>
                  <p className="font-mono text-xs">{asset.path || "/"}</p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">HTTP 响应</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">状态码</p>
                  <Badge variant={getStatusBadgeVariant(asset.statusCode)}>
                    {asset.statusCode}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">内容类型</p>
                  <p className="text-xs">{asset.contentType || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">内容长度</p>
                  <p>{formatBytes(asset.contentLength)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">标题</p>
                  <p className="truncate">{asset.title || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">字数</p>
                  <p>{asset.words.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">行数</p>
                  <p>{asset.lines.toLocaleString()}</p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ServerIcon className="size-4" />
                网络
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">主机 IP</p>
                  <p className="font-mono">{asset.hostIp || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">TLS</p>
                  <p>{asset.tls || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">DNS 记录</p>
                  {asset.aRecords.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {asset.aRecords.map((ip, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-xs">
                          {ip}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">-</p>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ShieldIcon className="size-4" />
                检测信息
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">资产类型</p>
                  <Badge variant="secondary">{asset.assetType}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">来源</p>
                  <p>{asset.source || "-"}</p>
                </div>
                {asset.technologies.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">技术栈</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {asset.technologies.map((tech, i) => (
                        <Badge key={i} variant="outline">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ClockIcon className="size-4" />
                元数据
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">响应时间</p>
                  <p>{asset.responseTime || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">备注</p>
                  <p>
                    {Array.isArray(asset.remarks)
                      ? asset.remarks.join(", ") || "-"
                      : asset.remarks || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">创建时间</p>
                  <p className="text-xs">{asset.createdAt.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">更新时间</p>
                  <p className="text-xs">{asset.updatedAt.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">最近发现时间</p>
                  <p className="text-xs">
                    {asset.lastSeenAt?.toLocaleString?.() ?? "-"}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
