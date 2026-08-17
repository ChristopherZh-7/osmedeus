"use client";

import * as React from "react";
import { deleteWorkspace, fetchWorkspacesList } from "@/lib/api/assets";
import type { Workspace, WorkspaceSortState, WorkspaceSortField } from "@/lib/types/asset";
import { WorkspacesTable } from "@/components/assets/workspaces-table";
import { sortWorkspaces } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DatabaseIcon, SearchIcon, RefreshCcwIcon, TagIcon, FolderOpenIcon, FilterIcon, FilterXIcon } from "lucide-react";
import { toast } from "sonner";

export default function InventoryWorkspacesPage() {
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [dataSource, setDataSource] = React.useState<string>("all");
  const [selectedTag, setSelectedTag] = React.useState<string>("all");
  const [hideZeroAssets, setHideZeroAssets] = React.useState<boolean>(false);
  const [useFilesystem, setUseFilesystem] = React.useState<boolean>(false);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [total, setTotal] = React.useState(0);
  const [mode, setMode] = React.useState<string | undefined>(undefined);
  const [sortState, setSortState] = React.useState<WorkspaceSortState>({
    field: "last_run",
    direction: "desc",
  });

  const loadWorkspaces = React.useCallback(async (force?: boolean) => {
    try {
      setIsLoading(true);
      const offset = (page - 1) * pageSize;
      const result = await fetchWorkspacesList({
        offset,
        limit: pageSize,
        search: search.trim() || undefined,
        filesystem: useFilesystem,
        data_source: !useFilesystem && dataSource !== "all" ? dataSource : undefined,
      });
      setWorkspaces(result.items);
      setTotal(result.pagination.total);
      setMode(result.mode);
    } catch (err) {
      toast.error("加载工作区失败", {
        description: err instanceof Error ? err.message : "",
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, dataSource, useFilesystem]);

  React.useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleSort = React.useCallback((field: WorkspaceSortField) => {
    setSortState((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const handleDelete = React.useCallback(async (workspace: Workspace): Promise<boolean> => {
    try {
      await deleteWorkspace(workspace.name, true);
      toast.success(`已删除工作区 ${workspace.name}`);
      if (workspaces.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        await loadWorkspaces(true);
      }
      return true;
    } catch (err) {
      const raw = err instanceof Error ? err.message : "删除工作区失败";
      toast.error("删除工作区失败", {
        description: raw.replace(/^\d+:/, ""),
      });
      return false;
    }
  }, [loadWorkspaces, page, workspaces.length]);

  const availableTags = React.useMemo(() => {
    const s = new Set<string>();
    for (const ws of workspaces) {
      for (const t of ws.tags ?? []) s.add(t);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [workspaces]);

  const clientFilteredWorkspaces = React.useMemo(() => {
    return workspaces.filter((ws) => {
      if (hideZeroAssets && ws.total_assets === 0) return false;
      if (selectedTag !== "all" && !(ws.tags ?? []).includes(selectedTag)) return false;
      return true;
    });
  }, [workspaces, hideZeroAssets, selectedTag]);

  // Apply client-side sorting
  const sortedWorkspaces = React.useMemo(() => {
    return sortWorkspaces(clientFilteredWorkspaces, sortState.field, sortState.direction);
  }, [clientFilteredWorkspaces, sortState]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      dataSource !== "all" ||
      selectedTag !== "all" ||
      hideZeroAssets
  );

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
              <CardTitle className="text-base">工作区清单</CardTitle>
              <CardDescription>
                {total !== undefined ? (
                  <>
                    <span className="font-medium text-foreground">
                      {total.toLocaleString()}
                    </span>{" "}
                    个工作区
                    {mode ? (
                      <>
                        {" "}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {mode}
                        </Badge>
                      </>
                    ) : null}
                  </>
                ) : (
                  "正在加载工作区……"
                )}
              </CardDescription>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant={useFilesystem ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setUseFilesystem(true);
                    setPage(1);
                  }}
                  disabled={isLoading && useFilesystem}
                >
                  <FolderOpenIcon className="size-4 mr-2" />
                  文件系统
                </Button>

                <Button
                  variant={!useFilesystem ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setUseFilesystem(false);
                    setPage(1);
                  }}
                  disabled={isLoading && !useFilesystem}
                >
                  <DatabaseIcon className="size-4 mr-2" />
                  数据库
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadWorkspaces(true)}
                  disabled={isLoading}
                >
                  <RefreshCcwIcon
                    className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                  />
                  刷新
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索工作区……"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>

              <Select
                value={selectedTag}
                onValueChange={(v) => {
                  setSelectedTag(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[170px]">
                  <span className="flex items-center gap-2">
                    <TagIcon className="size-4 text-muted-foreground" />
                    <SelectValue placeholder="标签" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部标签</SelectItem>
                  {availableTags.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant={hideZeroAssets ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setHideZeroAssets((prev) => !prev);
                  setPage(1);
                }}
              >
                {hideZeroAssets ? (
                  <FilterXIcon className="size-4 mr-2" />
                ) : (
                  <FilterIcon className="size-4 mr-2" />
                )}
                {hideZeroAssets ? "已隐藏零资产工作区" : "隐藏零资产工作区"}
              </Button>

              <Select
                value={dataSource}
                onValueChange={(v) => {
                  setDataSource(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[170px]">
                  <span className="flex items-center gap-2">
                    <DatabaseIcon className="size-4 text-muted-foreground" />
                    <SelectValue placeholder="数据来源" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部来源</SelectItem>
                  <SelectItem value="local">本地</SelectItem>
                  <SelectItem value="cloud">云端</SelectItem>
                  <SelectItem value="imported">已导入</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <WorkspacesTable
            workspaces={sortedWorkspaces}
            isLoading={isLoading}
            pagination={{
              page,
              pageSize,
              totalItems: total,
              totalPages,
            }}
            sortState={sortState}
            onSort={handleSort}
            onPageChange={setPage}
            onDelete={handleDelete}
            hasActiveFilters={hasActiveFilters}
          />
        </CardContent>
      </Card>
    </div>
  );
}
