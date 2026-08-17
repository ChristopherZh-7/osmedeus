"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanStatusBadge } from "./scan-status-badge";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CellShell, DataGrid, type GridColDef } from "@/components/ui/data-grid";
import { cn, truncate } from "@/lib/utils";
import type { Scan } from "@/lib/types/scan";
import {
  EyeIcon,
  StopCircleIcon,
  TrashIcon,
  ScanSearchIcon,
  CalendarIcon,
  PlayIcon,
  CopyIcon,
  LoaderIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cancelScan, deleteScan, duplicateScanRun, startScanRun } from "@/lib/api/scans";

interface ScanTableProps {
  scans: Scan[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onSelectScan?: (scan: Scan) => void;
}

type TriggerVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "purple"
  | "pink"
  | "cyan"
  | "orange";

const TRIGGER_CONFIG: Record<
  string,
  { label: string; variant: TriggerVariant; icon: React.ReactNode }
> = {
  cli: { label: "CLI", variant: "purple", icon: <PlayIcon className="size-3" /> },
  api: { label: "API", variant: "info", icon: <PlayIcon className="size-3" /> },
  cron: { label: "Cron", variant: "warning", icon: <CalendarIcon className="size-3" /> },
  scheduled: {
    label: "计划任务",
    variant: "warning",
    icon: <CalendarIcon className="size-3" />,
  },
  manual: { label: "手动", variant: "secondary", icon: <PlayIcon className="size-3" /> },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  high: { label: "高", className: "border-destructive/50 text-destructive" },
  medium: { label: "中", className: "border-warning/50 text-warning" },
  low: { label: "低", className: "border-success/50 text-success" },
};

const PRIORITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * Sorts blanks to the bottom in *both* directions. AG Grid flips the sign of a
 * comparator's result for a descending sort, so a blank check has to undo that
 * flip itself or empty rows float to the top the moment you reverse the order.
 */
function blanksLast<V>(
  compare: (a: V, b: V) => number,
  isBlank: (v: V) => boolean
) {
  return (a: V, b: V, _nodeA: unknown, _nodeB: unknown, isDescending: boolean) => {
    const aBlank = isBlank(a);
    const bBlank = isBlank(b);
    if (aBlank && bBlank) return 0;
    if (aBlank) return isDescending ? -1 : 1;
    if (bBlank) return isDescending ? 1 : -1;
    return compare(a, b);
  };
}

const compareText = blanksLast<string>(
  (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  (v) => !v
);

export function ScanTable({ scans, isLoading, onRefresh, onSelectScan }: ScanTableProps) {
  const [duplicateRunId, setDuplicateRunId] = React.useState<string | null>(null);
  const [confirmState, setConfirmState] = React.useState<{
    action: "duplicate" | "cancel" | "delete";
    scan: Scan;
  } | null>(null);

  const handleCancel = React.useCallback(
    async (scan: Scan) => {
      try {
        const runUuid = scan.runUuid || scan.runId || scan.id;
        const success = await cancelScan(runUuid);
        if (success) {
          toast.success("扫描已取消", {
            description: `目标 ${scan.target} 的扫描已取消。`,
          });
          onRefresh?.();
        } else {
          toast.error("取消扫描失败");
        }
      } catch {
        toast.error("取消扫描失败");
      }
    },
    [onRefresh]
  );

  const handleDelete = React.useCallback(
    async (scan: Scan) => {
      try {
        const runUuid = scan.runUuid || scan.runId || scan.id;
        if (!runUuid) {
          toast.error("删除扫描失败", { description: "缺少运行标识" });
          return;
        }
        const success = await deleteScan(runUuid);
        if (success) {
          toast.success("扫描已删除", {
            description: `目标 ${scan.target} 的扫描已删除。`,
          });
          onRefresh?.();
        } else {
          toast.error("删除扫描失败");
        }
      } catch (error) {
        const description =
          error instanceof Error ? error.message.replace(/^\d+:/, "") : undefined;
        toast.error("删除扫描失败", { description });
      }
    },
    [onRefresh]
  );

  const handleDuplicateAndStart = React.useCallback(
    async (scan: Scan) => {
      const runUuid = scan.runUuid || scan.runId || scan.id;
      if (!runUuid) {
        toast.error("缺少运行标识");
        return;
      }
      try {
        setDuplicateRunId(runUuid);
        const duplicated = await duplicateScanRun(runUuid);
        const newRunUuid = duplicated.runUuid || duplicated.runId || duplicated.id;
        if (!newRunUuid) {
          toast.error("已创建副本，但缺少运行标识");
          return;
        }
        const started = await startScanRun(newRunUuid);
        if (started) {
          toast.success("扫描已复制并启动", {
            description: `目标 ${duplicated.target || scan.target} 的扫描正在运行。`,
          });
        } else {
          toast.success("扫描已复制", {
            description: `已为目标 ${duplicated.target || scan.target} 创建扫描副本。`,
          });
        }
        onRefresh?.();
      } catch {
        toast.error("复制扫描失败");
      } finally {
        setDuplicateRunId(null);
      }
    },
    [onRefresh]
  );

  const handleConfirmAction = React.useCallback(async () => {
    if (!confirmState) return;
    const { action, scan } = confirmState;
    setConfirmState(null);
    if (action === "duplicate") return handleDuplicateAndStart(scan);
    if (action === "cancel") return handleCancel(scan);
    return handleDelete(scan);
  }, [confirmState, handleCancel, handleDelete, handleDuplicateAndStart]);

  const columns = React.useMemo<GridColDef<Scan>[]>(
    () => [
      {
        field: "status",
        headerName: "状态",
        minWidth: 120,
        flex: 0,
        width: 130,
        comparator: compareText,
        cellRenderer: (p: { data: Scan }) => <ScanStatusBadge status={p.data.status} />,
      },
      {
        field: "workflowName",
        colId: "workflow",
        headerName: "工作流",
        minWidth: 150,
        comparator: compareText,
        cellRenderer: (p: { data: Scan }) => (
          <div className="flex min-w-0 flex-col justify-center leading-tight">
            <span className="truncate font-medium">{p.data.workflowName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {p.data.workflowKind}
            </span>
          </div>
        ),
      },
      {
        field: "target",
        headerName: "目标",
        minWidth: 160,
        flex: 2,
        comparator: compareText,
        cellRenderer: (p: { value: string }) => (
          <span className="truncate font-mono text-sm">{truncate(p.value, 30)}</span>
        ),
      },
      {
        colId: "priority",
        headerName: "优先级",
        minWidth: 110,
        flex: 0,
        width: 120,
        valueGetter: (p) =>
          p.data?.priority ? String(p.data.priority).toLowerCase() : "",
        comparator: blanksLast<string>(
          (a, b) => (PRIORITY_ORDER[a] ?? 0) - (PRIORITY_ORDER[b] ?? 0),
          (v) => !v
        ),
        cellRenderer: (p: { value: string }) =>
          p.value ? (
            <Badge
              variant="outline"
              className={cn("w-fit capitalize", PRIORITY_CONFIG[p.value]?.className)}
            >
              {PRIORITY_CONFIG[p.value]?.label ?? p.value}
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        colId: "progress",
        headerName: "步骤",
        minWidth: 160,
        valueGetter: (p) => {
          const total = p.data?.totalSteps ?? 0;
          return total > 0 ? (p.data?.completedSteps ?? 0) / total : -1;
        },
        comparator: blanksLast<number>((a, b) => a - b, (v) => v < 0),
        cellRenderer: (p: { data: Scan }) => {
          const scan = p.data;
          if (scan.totalSteps > 0) {
            return (
              <CellShell className="gap-2">
                <span className="whitespace-nowrap text-sm">
                  {scan.completedSteps}/{scan.totalSteps} 个步骤
                </span>
                <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.round((scan.completedSteps / scan.totalSteps) * 100)}%`,
                    }}
                  />
                </div>
              </CellShell>
            );
          }
          return (
            <span className="text-muted-foreground">
              {scan.status === "running" ? "进行中……" : "-"}
            </span>
          );
        },
      },
      {
        colId: "trigger",
        headerName: "触发器",
        minWidth: 130,
        valueGetter: (p) => p.data?.triggerType ?? "",
        comparator: compareText,
        cellRenderer: (p: { data: Scan }) => {
          const type = (p.data.triggerType || "manual").toLowerCase();
          const cfg = TRIGGER_CONFIG[type] ?? {
            label: p.data.triggerType || "manual",
            variant: "outline" as TriggerVariant,
            icon: <PlayIcon className="size-3" />,
          };
          return (
            <div className="flex min-w-0 flex-col justify-center gap-1">
              <Badge variant={cfg.variant} className="w-fit gap-1">
                {cfg.icon}
                <span>{cfg.label}</span>
              </Badge>
              {p.data.triggerName ? (
                <span className="truncate text-xs text-muted-foreground">
                  {truncate(p.data.triggerName, 22)}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        colId: "actions",
        headerName: "操作",
        minWidth: 132,
        flex: 0,
        width: 132,
        sortable: false,
        cellRenderer: (p: { data: Scan }) => {
          const scan = p.data;
          const runUuid = scan.runUuid || scan.runId || scan.id;
          const isDuplicating = duplicateRunId === runUuid;
          const isActive = scan.status === "running" || scan.status === "pending";

          return (
            <CellShell className="w-full justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="border-info/40 text-info hover:bg-info-soft hover:text-info hover:shadow-none"
                    onClick={() => onSelectScan?.(scan)}
                    aria-label="查看扫描详情"
                  >
                    <EyeIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">查看详情</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="border-purple/40 text-purple hover:bg-purple-soft hover:text-purple hover:shadow-none"
                    onClick={() => setConfirmState({ action: "duplicate", scan })}
                    aria-label="复制并启动扫描"
                    disabled={isDuplicating}
                  >
                    {isDuplicating ? (
                      <LoaderIcon className="size-4 animate-spin" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">复制并启动</TooltipContent>
              </Tooltip>
              {isActive ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="border-warning/40 text-warning hover:bg-warning-soft hover:text-warning hover:shadow-none"
                      onClick={() => setConfirmState({ action: "cancel", scan })}
                      aria-label="停止扫描"
                    >
                      <StopCircleIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">停止扫描</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="border-destructive/40 text-destructive hover:bg-destructive-soft hover:text-destructive hover:shadow-none"
                      onClick={() => setConfirmState({ action: "delete", scan })}
                      aria-label="删除扫描"
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">删除扫描</TooltipContent>
                </Tooltip>
              )}
            </CellShell>
          );
        },
      },
    ],
    [duplicateRunId, onSelectScan]
  );

  if (isLoading) {
    return <TableSkeleton rows={5} columns={7} />;
  }

  return (
    <>
      <TooltipProvider>
        <DataGrid<Scan>
          rows={scans}
          columns={columns}
          getRowId={(scan) => String(scan.id)}
          // Row heights carry two stacked lines in the workflow and trigger
          // cells, so they need a little more room than the shared default.
          rowHeight={44}
          initialState={{ sort: { sortModel: [{ colId: "status", sort: "asc" }] } }}
          emptyState={
            <EmptyState
              icon={ScanSearchIcon}
              title="未找到扫描任务"
              description="启动首次安全扫描后，结果将显示在这里。"
              action={{
                label: "新建扫描",
                onClick: () => (window.location.href = "/scans/new"),
              }}
            />
          }
        />
      </TooltipProvider>
      <Dialog
        open={!!confirmState}
        onOpenChange={(open) => (!open ? setConfirmState(null) : null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmState?.action === "duplicate"
                ? "复制并启动扫描"
                : confirmState?.action === "cancel"
                  ? "停止正在运行的扫描"
                  : "删除扫描"}
            </DialogTitle>
            <DialogDescription>
              {confirmState?.action === "duplicate"
                ? "创建新的运行记录并立即启动吗？"
                : confirmState?.action === "cancel"
                  ? "确定停止所选扫描吗？此操作无法撤销。"
                  : "确定删除所选扫描吗？此操作无法撤销。"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmState(null)}>
              取消
            </Button>
            <Button
              variant={confirmState?.action === "delete" ? "destructive" : "default"}
              onClick={handleConfirmAction}
            >
              确认
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
