"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import {
  CellShell,
  DataGrid,
  GridPagination,
  GridRefreshOverlay,
  MonoCell,
  TextCell,
  type GridColDef,
} from "@/components/ui/data-grid";
import { getTechDotColor, getStatusBadgeVariant, cn } from "@/lib/utils";
import type { HttpAsset, AssetSortState, AssetSortField } from "@/lib/types/asset";
import { toast } from "sonner";
import { LinkIcon, ExternalLinkIcon, CopyIcon, SearchXIcon } from "lucide-react";

export type HttpAssetsColumnKey =
  | "id"
  | "workspace"
  | "assetValue"
  | "url"
  | "input"
  | "scheme"
  | "method"
  | "path"
  | "statusCode"
  | "contentType"
  | "contentLength"
  | "title"
  | "words"
  | "lines"
  | "hostIp"
  | "dnsRecords"
  | "tls"
  | "assetType"
  | "technologies"
  | "responseTime"
  | "remarks"
  | "source"
  | "createdAt"
  | "updatedAt"
  | "lastSeenAt";

const defaultVisibleColumns: Record<HttpAssetsColumnKey, boolean> = {
  id: false,
  workspace: false,
  assetValue: true,
  url: false,
  input: false,
  scheme: false,
  method: false,
  path: false,
  statusCode: true,
  contentType: false,
  contentLength: true,
  title: true,
  words: false,
  lines: false,
  hostIp: true,
  dnsRecords: false,
  tls: false,
  assetType: true,
  remarks: true,
  technologies: true,
  responseTime: false,
  source: false,
  createdAt: false,
  updatedAt: false,
  lastSeenAt: false,
};

/**
 * Column keys the backend can sort on. Everything else sorts client-side within
 * the current page, which is what the grid does by default.
 */
const SERVER_SORT_FIELDS: Partial<Record<HttpAssetsColumnKey, AssetSortField>> = {
  assetValue: "url",
  statusCode: "statusCode",
  contentLength: "contentLength",
  title: "title",
  hostIp: "hostIp",
  technologies: "technologies",
  responseTime: "responseTime",
};

interface HttpAssetsTableProps {
  assets: HttpAsset[];
  isLoading?: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  sortState: AssetSortState;
  onSort: (field: AssetSortField) => void;
  onPageChange?: (page: number) => void;
  onSelect?: (asset: HttpAsset) => void;
  hasActiveFilters?: boolean;
  visibleColumns?: Record<HttpAssetsColumnKey, boolean>;
  density?: "comfortable" | "compact";
}

/* -------------------------------------------------------------------------- */
/* Cell renderers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Row action buttons read as small chips rather than bare glyphs — a border and
 * a raised fill lift them off the row tint, which a ghost icon alone did not do.
 */
const ROW_ACTION_CLASS =
  "size-7 rounded-control border border-border-subtle bg-raised text-body shadow-xs hover:border-border-strong hover:bg-sunken hover:text-primary";

function AssetValueCell({ data }: { data: HttpAsset }) {
  const assetValue = data.assetValue || data.url;
  const isUrlValue = /^https?:\/\//i.test(assetValue);
  const urlToOpen = data.url || (isUrlValue ? assetValue : "");

  const copy = React.useCallback(
    async (event: React.MouseEvent) => {
      event.stopPropagation();
      try {
        await navigator.clipboard.writeText(assetValue);
        toast.success("URL 已复制");
      } catch {
        toast.error("复制 URL 失败");
      }
    },
    [assetValue]
  );

  if (!assetValue) return <span className="text-muted-foreground">-</span>;

  // Clipping is left to CSS (`truncate`) rather than a fixed character count, so
  // widening the column actually reveals more of the value.
  const label = isUrlValue ? (
    <a
      href={urlToOpen || assetValue}
      target="_blank"
      rel="noopener noreferrer"
      className="min-w-0 truncate font-mono text-sm text-primary hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {assetValue}
    </a>
  ) : (
    <span className="min-w-0 truncate font-mono text-sm text-foreground">{assetValue}</span>
  );

  return (
    <CellShell className="group/cell">
      <Tooltip>
        <TooltipTrigger asChild>{label}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[520px] break-all font-mono">
          {assetValue}
        </TooltipContent>
      </Tooltip>
      {/* Row actions sit at a low opacity so a 500-row page isn't a wall of
          icons, but stay legible enough to be discoverable without hovering;
          hovering or focusing the cell brings them to full strength. */}
      <span className="flex shrink-0 items-center gap-1 opacity-55 transition-opacity group-hover/cell:opacity-100 focus-within:opacity-100">
        {isUrlValue && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={ROW_ACTION_CLASS} onClick={copy}>
                <CopyIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">复制 URL</TooltipContent>
          </Tooltip>
        )}
        {urlToOpen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={ROW_ACTION_CLASS} asChild>
                <a
                  href={urlToOpen}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLinkIcon className="size-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">打开 URL</TooltipContent>
          </Tooltip>
        )}
      </span>
    </CellShell>
  );
}

function TitleCell({ value }: { value?: string }) {
  if (!value) return <span className="text-muted-foreground">-</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="truncate cursor-default">{value}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px]">
        {value}
      </TooltipContent>
    </Tooltip>
  );
}

/** Up to two chips plus a `+n` overflow that reveals the rest on hover. */
function ChipListCell({
  items,
  render,
  emptyLabel = "-",
  overflowTitle,
}: {
  items: string[];
  render: (item: string, key: string) => React.ReactNode;
  emptyLabel?: string;
  overflowTitle?: string;
}) {
  if (items.length === 0) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  const visible = items.slice(0, 2);
  const overflow = items.length - visible.length;

  const chips = (
    <CellShell className="gap-1">
      {visible.map((item, i) => render(item, `v-${i}`))}
      {overflow > 0 && (
        <Badge variant="secondary" className="text-xs">
          +{overflow}
        </Badge>
      )}
    </CellShell>
  );

  if (overflow === 0) return chips;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chips}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px] p-2">
        {overflowTitle && (
          <p className="mb-1.5 px-0.5 text-2xs text-background/60">{overflowTitle}</p>
        )}
        <div className="flex flex-wrap gap-1">
          {items.map((item, i) => render(item, `all-${i}`))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function TechChip(tech: string, key: string) {
  return (
    <Badge key={key} variant="outline" className="gap-1.5 text-xs font-medium">
      <span className={cn("size-1.5 shrink-0 rounded-full", getTechDotColor(tech))} />
      <span className="block max-w-[140px] truncate">{tech.split("/")[0]}</span>
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */

export function HttpAssetsTable({
  assets,
  isLoading,
  pagination,
  sortState,
  onSort,
  onPageChange,
  onSelect,
  hasActiveFilters,
  visibleColumns,
  density = "comfortable",
}: HttpAssetsTableProps) {
  const resolvedVisibleColumns = React.useMemo(
    () => ({ ...defaultVisibleColumns, ...(visibleColumns ?? {}) }),
    [visibleColumns]
  );

  const columns = React.useMemo<GridColDef<HttpAsset>[]>(() => {
    // Declared once in display order; the visibility map filters it. Widths are
    // minimums — `flex` lets the visible set expand to fill the viewport, so
    // hiding columns never leaves dead space on the right.
    const all: Array<GridColDef<HttpAsset> & { key: HttpAssetsColumnKey }> = [
      {
        key: "id",
        field: "id",
        headerName: "ID",
        minWidth: 80,
        flex: 0,
        width: 90,
        cellRenderer: (p: { value: string }) => <MonoCell value={p.value} />,
      },
      {
        key: "workspace",
        field: "workspace",
        headerName: "工作区",
        minWidth: 140,
        cellRenderer: (p: { value?: string }) => <TextCell value={p.value} />,
      },
      {
        key: "assetValue",
        colId: "assetValue",
        headerName: "资产值",
        // The widest column by design: it carries a full URL plus two row
        // actions, so it takes the largest flex share and floors well above the
        // point where the copy/open buttons start eating the value.
        minWidth: 360,
        flex: 3,
        valueGetter: (p) => p.data?.assetValue || p.data?.url || "",
        cellRenderer: (p: { data: HttpAsset }) => <AssetValueCell data={p.data} />,
      },
      {
        key: "url",
        field: "url",
        headerName: "URL",
        minWidth: 220,
        flex: 2,
        cellRenderer: (p: { value?: string }) =>
          p.value ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={p.value.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate font-mono text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {p.value.trim()}
                </a>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[520px] break-all font-mono">
                {p.value.trim()}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        key: "input",
        field: "input",
        headerName: "输入",
        minWidth: 160,
        cellRenderer: (p: { value?: string }) => <MonoCell value={p.value} />,
      },
      {
        key: "scheme",
        field: "scheme",
        headerName: "协议",
        minWidth: 90,
        flex: 0,
        width: 100,
        cellRenderer: (p: { value?: string }) => <MonoCell value={p.value} />,
      },
      {
        key: "method",
        field: "method",
        headerName: "方法",
        minWidth: 90,
        flex: 0,
        width: 100,
        cellRenderer: (p: { value?: string }) =>
          p.value ? (
            <Badge variant="outline" className="text-xs">
              {p.value}
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        key: "path",
        field: "path",
        headerName: "路径",
        minWidth: 150,
        cellRenderer: (p: { value?: string }) => <MonoCell value={p.value} />,
      },
      {
        key: "statusCode",
        field: "statusCode",
        headerName: "状态",
        minWidth: 90,
        flex: 0,
        width: 100,
        cellRenderer: (p: { value: number }) => (
          <Badge variant={getStatusBadgeVariant(p.value)}>{p.value}</Badge>
        ),
      },
      {
        key: "contentType",
        field: "contentType",
        headerName: "内容类型",
        minWidth: 170,
        cellRenderer: (p: { value?: string }) => <TextCell value={p.value} />,
      },
      {
        key: "contentLength",
        field: "contentLength",
        headerName: "内容长度",
        minWidth: 120,
        flex: 0,
        width: 130,
        type: "numericColumn",
        cellClass: "font-mono tabular-nums text-muted-foreground",
        valueFormatter: (p) => (p.value ?? 0).toLocaleString(),
      },
      {
        key: "title",
        field: "title",
        headerName: "标题",
        minWidth: 150,
        cellRenderer: (p: { value?: string }) => <TitleCell value={p.value} />,
      },
      {
        key: "words",
        field: "words",
        headerName: "字数",
        minWidth: 90,
        flex: 0,
        width: 100,
        type: "numericColumn",
        cellClass: "font-mono tabular-nums",
        valueFormatter: (p) => p.value?.toLocaleString?.() ?? "-",
      },
      {
        key: "lines",
        field: "lines",
        headerName: "行数",
        minWidth: 90,
        flex: 0,
        width: 100,
        type: "numericColumn",
        cellClass: "font-mono tabular-nums",
        valueFormatter: (p) => p.value?.toLocaleString?.() ?? "-",
      },
      {
        key: "hostIp",
        field: "hostIp",
        headerName: "主机 IP",
        minWidth: 120,
        cellRenderer: (p: { value?: string }) => <MonoCell value={p.value} />,
      },
      {
        key: "dnsRecords",
        colId: "dnsRecords",
        headerName: "DNS 记录",
        minWidth: 160,
        sortable: false,
        valueGetter: (p) => p.data?.aRecords ?? [],
        cellRenderer: (p: { data: HttpAsset }) => (
          <ChipListCell
            items={p.data.aRecords ?? []}
            render={(record, key) => (
              <Badge key={key} variant="outline" className="text-xs font-mono">
                {record}
              </Badge>
            )}
          />
        ),
      },
      {
        key: "tls",
        field: "tls",
        headerName: "TLS",
        minWidth: 100,
        cellRenderer: (p: { value?: string }) => <TextCell value={p.value} />,
      },
      {
        key: "assetType",
        field: "assetType",
        headerName: "资产类型",
        minWidth: 110,
        cellRenderer: (p: { value?: string }) =>
          p.value ? (
            <Badge variant="secondary" className="text-xs font-mono">
              {p.value}
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        key: "remarks",
        colId: "remarks",
        headerName: "备注",
        minWidth: 160,
        sortable: false,
        cellRenderer: (p: { data: HttpAsset }) => {
          const remarks = Array.isArray(p.data.remarks)
            ? p.data.remarks
            : p.data.remarks
              ? [p.data.remarks]
              : [];
          return (
            <ChipListCell
              items={remarks}
              render={(remark, key) => (
                <Badge key={key} variant="outline" className="text-xs">
                  {remark}
                </Badge>
              )}
            />
          );
        },
      },
      {
        key: "technologies",
        colId: "technologies",
        headerName: "技术栈",
        minWidth: 150,
        valueGetter: (p) => (p.data?.technologies ?? []).join(", "),
        cellRenderer: (p: { data: HttpAsset }) => {
          const techs = (p.data.technologies ?? [])
            .map((t) => t.trim())
            .filter(Boolean);
          return (
            <ChipListCell
              items={techs}
              render={TechChip}
              overflowTitle={`${techs.length} 项技术`}
            />
          );
        },
      },
      {
        key: "responseTime",
        field: "responseTime",
        headerName: "时间",
        minWidth: 110,
        flex: 0,
        width: 120,
        cellRenderer: (p: { value?: string }) => <TextCell value={p.value} />,
      },
      {
        key: "source",
        field: "source",
        headerName: "来源",
        minWidth: 110,
        cellRenderer: (p: { value?: string }) => <TextCell value={p.value} />,
      },
      {
        key: "createdAt",
        field: "createdAt",
        headerName: "创建时间",
        minWidth: 150,
        cellClass: "text-xs",
        valueFormatter: (p) => p.value?.toLocaleString?.() ?? "-",
      },
      {
        key: "updatedAt",
        field: "updatedAt",
        headerName: "更新时间",
        minWidth: 150,
        cellClass: "text-xs",
        valueFormatter: (p) => p.value?.toLocaleString?.() ?? "-",
      },
      {
        key: "lastSeenAt",
        field: "lastSeenAt",
        headerName: "最近发现时间",
        minWidth: 150,
        cellClass: "text-xs",
        valueFormatter: (p) => p.value?.toLocaleString?.() ?? "-",
      },
    ];

    return all
      .filter((c) => resolvedVisibleColumns[c.key])
      .map(({ key, ...col }) => {
        const serverField = SERVER_SORT_FIELDS[key];
        return {
          ...col,
          // Columns the API can order by keep their sort on the server so
          // sorting spans every page, not just the rows currently loaded.
          comparator: serverField ? () => 0 : col.comparator,
          sort:
            serverField && sortState.field === serverField
              ? (sortState.direction as "asc" | "desc")
              : null,
        } satisfies GridColDef<HttpAsset>;
      });
  }, [resolvedVisibleColumns, sortState]);

  const handleSortChanged = React.useCallback(
    (event: { columns?: { getColId(): string }[] | null }) => {
      const changed = event.columns?.[0];
      if (!changed) return;
      const serverField = SERVER_SORT_FIELDS[changed.getColId() as HttpAssetsColumnKey];
      if (serverField) onSort(serverField);
    },
    [onSort]
  );

  return (
    <TooltipProvider>
      <div className="relative space-y-4">
        {isLoading && assets.length > 0 && <GridRefreshOverlay />}

        <DataGrid<HttpAsset>
          rows={assets}
          columns={columns}
          getRowId={(asset) => String(asset.id)}
          density={density}
          loading={isLoading}
          onRowClick={onSelect}
          onSortChanged={handleSortChanged}
          maxAutoHeight={720}
          emptyState={
            <div className="relative flex min-h-[360px] items-center justify-center">
              <EmptyState
                icon={hasActiveFilters ? SearchXIcon : LinkIcon}
                title={hasActiveFilters ? "没有匹配的资产" : "未找到资产"}
                description={
                  hasActiveFilters
                    ? "没有 HTTP 资产符合当前筛选条件，请调整或清除部分筛选条件。"
                    : "尚未发现 HTTP 资产，请运行扫描任务开始发现资产。"
                }
              />
            </div>
          }
        />

        {pagination && (
          <GridPagination pagination={pagination} onPageChange={onPageChange} />
        )}
      </div>
    </TooltipProvider>
  );
}
