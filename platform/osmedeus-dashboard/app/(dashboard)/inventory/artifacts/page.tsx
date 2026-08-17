"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import jsonLang from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import yamlLang from "react-syntax-highlighter/dist/esm/languages/hljs/yaml";
import markdownLang from "react-syntax-highlighter/dist/esm/languages/hljs/markdown";
import xmlLang from "react-syntax-highlighter/dist/esm/languages/hljs/xml";
import github from "react-syntax-highlighter/dist/esm/styles/hljs/github";
import atomOneDark from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";
import {
  fetchArtifacts,
  fetchArtifactContent,
  buildWorkspaceArtifactUrl,
} from "@/lib/api/artifacts";
import type { SortDirection } from "@/lib/types/asset";
import type { Artifact } from "@/lib/types/artifact";
import type { PaginatedResponse } from "@/lib/types/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { AnimatePresence, motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { formatBytes } from "@/lib/utils";
import {
  ArchiveIcon,
  BookCheckIcon,
  BookSearchIcon,
  ClipboardIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderOpenIcon,
  LoaderIcon,
  RefreshCcwIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  SearchXIcon,
  TagIcon,
} from "lucide-react";
import { toast } from "sonner";

type ArtifactSortField =
  | "name"
  | "workspace"
  | "artifactType"
  | "contentType"
  | "sizeBytes"
  | "actions";

function inferLanguage(contentType?: string): string {
  const v = (contentType ?? "").trim().toLowerCase();
  if (v === "md" || v === "markdown") return "markdown";
  if (v === "json") return "json";
  if (v === "yaml" || v === "yml") return "yaml";
  if (v === "html" || v === "htm") return "xml";
  return "text";
}

function inferLanguageForArtifact(artifact: Artifact | null): string {
  if (!artifact) return "text";
  const p = (artifact.artifactPath ?? "").trim().toLowerCase();
  if (p.endsWith(".md") || p.endsWith(".markdown")) return "markdown";
  if (p.endsWith(".json")) return "json";
  if (p.endsWith(".yaml") || p.endsWith(".yml")) return "yaml";
  if (p.endsWith(".html") || p.endsWith(".htm")) return "xml";
  return inferLanguage(artifact.contentType);
}

function inferMime(contentType?: string): string {
  const v = (contentType ?? "").trim().toLowerCase();
  if (v === "md" || v === "markdown") return "text/markdown";
  if (v === "json") return "application/json";
  if (v === "yaml" || v === "yml") return "text/yaml";
  if (v === "log") return "text/plain";
  if (v === "txt") return "text/plain";
  return "text/plain";
}

function inferDownloadName(artifact: Artifact | null): string {
  if (!artifact) return "artifact.txt";
  const p = (artifact.artifactPath ?? "").replace(/\\/g, "/");
  const base = p.split("/").filter(Boolean).pop();
  if (base && base.includes(".")) return base;
  const ct = (artifact.contentType ?? "").trim().toLowerCase();
  const ext = ct && ct !== "unknown" && ct !== "folder" ? ct : "txt";
  const name = (artifact.name ?? "artifact").trim() || "artifact";
  return name.includes(".") ? name : `${name}.${ext}`;
}

function isMarkdownArtifact(artifact: Artifact | null): boolean {
  if (!artifact) return false;
  const ct = (artifact.contentType ?? "").trim().toLowerCase();
  if (ct === "md" || ct === "markdown") return true;
  const p = (artifact.artifactPath ?? "").trim().toLowerCase();
  return p.endsWith(".md") || p.endsWith(".markdown");
}

function isHtmlArtifact(artifact: Artifact | null): boolean {
  if (!artifact) return false;
  const ct = (artifact.contentType ?? "").trim().toLowerCase();
  if (ct === "html" || ct === "htm") return true;
  const p = (artifact.artifactPath ?? "").trim().toLowerCase();
  return p.endsWith(".html") || p.endsWith(".htm");
}

function buildReportSrcDoc(inputHtml: string): string {
  const safe = String(inputHtml ?? "");
  return `<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root{color-scheme: light dark;}
  html,body{margin:0;padding:0;background:transparent;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans;}
  body{padding:16px;}
  img{max-width:100%;height:auto;}
  pre{white-space:pre-wrap;word-break:break-word;}
</style></head><body>${safe}</body></html>`;
}

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

function artifactTypeVariant(value?: string): BadgeVariant {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "report") return "info";
  if (v === "output") return "cyan";
  if (v === "state_file") return "orange";
  if (v === "screenshot") return "purple";
  return "secondary";
}

function contentTypeVariant(value?: string): BadgeVariant {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "md" || v === "markdown") return "purple";
  if (v === "json") return "cyan";
  if (v === "yaml" || v === "yml") return "orange";
  if (v === "log") return "warning";
  if (v === "txt") return "secondary";
  if (v === "folder") return "info";
  if (v === "unknown") return "outline";
  return "outline";
}

export default function InventoryArtifactsPage() {
  const { resolvedTheme } = useTheme();
  const searchParams = useSearchParams();
  const workspaceParam = (searchParams.get("workspace") ?? "").trim();
  const CodeHighlighter = SyntaxHighlighter as unknown as React.ComponentType<any>;
  const [selectedWorkspace, setSelectedWorkspace] = React.useState<string>(() =>
    workspaceParam ? workspaceParam : "all"
  );
  const [selectedArtifactType, setSelectedArtifactType] = React.useState<string>("all");
  const [selectedContentType, setSelectedContentType] = React.useState<string>("all");
  const [search, setSearch] = React.useState<string>("");
  const [verifyExistOnly, setVerifyExistOnly] = React.useState<boolean>(true);
  const [collapsedWorkspaces, setCollapsedWorkspaces] = React.useState<Record<string, boolean>>({});

  const [selectedArtifact, setSelectedArtifact] = React.useState<Artifact | null>(null);
  const [detailTab, setDetailTab] = React.useState<string>("details");
  const [contentLoading, setContentLoading] = React.useState(false);
  const [contentText, setContentText] = React.useState<string>("");
  const [contentError, setContentError] = React.useState<string>("");

  const [artifactsResponse, setArtifactsResponse] =
    React.useState<PaginatedResponse<Artifact> | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const forceNextRef = React.useRef<boolean>(false);

  const [sortState, setSortState] = React.useState<{
    field: ArtifactSortField | null;
    direction: SortDirection;
  }>({ field: "sizeBytes", direction: "desc" });

  React.useEffect(() => {
    SyntaxHighlighter.registerLanguage("json", jsonLang);
    SyntaxHighlighter.registerLanguage("yaml", yamlLang);
    SyntaxHighlighter.registerLanguage("markdown", markdownLang);
    SyntaxHighlighter.registerLanguage("xml", xmlLang);
  }, []);

  const loadArtifacts = React.useCallback(
    async () => {
      try {
        setIsLoading(true);
        const effectiveWorkspace = selectedWorkspace === "all" ? undefined : selectedWorkspace;

        const res = await fetchArtifacts({
          page,
          pageSize,
          verifyExist: verifyExistOnly ? true : undefined,
          filters: {
            workspace: effectiveWorkspace,
            artifactType:
              selectedArtifactType !== "all" ? selectedArtifactType : undefined,
          },
        });

        const tp = res.pagination?.totalPages ?? 0;
        if (tp > 0 && page > tp) {
          setPage(tp);
          forceNextRef.current = true;
          return;
        }
        setArtifactsResponse(res);
      } catch (e) {
        toast.error("加载产物失败", {
          description: e instanceof Error ? e.message : "",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [page, pageSize, selectedWorkspace, selectedArtifactType, verifyExistOnly]
  );

  React.useEffect(() => {
    const doLoad = async () => {
      await loadArtifacts();
      forceNextRef.current = false;
    };
    doLoad();
  }, [loadArtifacts]);

  const openDetails = React.useCallback((a: Artifact) => {
    setSelectedArtifact(a);
    setDetailTab("content");
    setContentLoading(false);
    setContentError("");
    setContentText("");
  }, []);

  const loadArtifactContent = React.useCallback(async (a: Artifact) => {
    setSelectedArtifact(a);
    setContentLoading(true);
    setContentError("");
    setContentText("");
    try {
      const text = await fetchArtifactContent({
        workspace: a.workspace,
        artifactPath: a.artifactPath,
      });
      setContentText(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setContentError(msg || "获取产物内容失败");
      toast.error("获取产物内容失败", {
        description: msg,
      });
    } finally {
      setContentLoading(false);
    }
  }, []);

  const openContent = React.useCallback(
    (a: Artifact) => {
      setDetailTab("content");
      void loadArtifactContent(a);
    },
    [loadArtifactContent]
  );

  const openArtifactInNewTab = React.useCallback((a: Artifact) => {
    const url = buildWorkspaceArtifactUrl({
      workspace: a.workspace,
      artifactPath: a.artifactPath,
    });
    if (!url) {
      toast.error("未设置工作区访问密钥", {
        description:
          "请在“设置 → API 配置”中添加，以便在新标签页打开原始产物。",
      });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const artifactTypes = React.useMemo(() => {
    const set = new Set<string>(["report", "output", "state_file", "screenshot"]);
    (artifactsResponse?.data ?? []).forEach((a) => {
      const t = (a.artifactType ?? "").trim();
      if (t) set.add(t);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [artifactsResponse?.data]);

  const workspaceOptions = React.useMemo(() => {
    const set = new Set<string>();
    (artifactsResponse?.data ?? []).forEach((a) => {
      const ws = String(a.workspace ?? "").trim();
      if (ws) set.add(ws);
    });
    const selected = (selectedWorkspace ?? "").trim();
    if (selected && selected !== "all") set.add(selected);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [artifactsResponse?.data, selectedWorkspace]);

  const contentTypes = React.useMemo(() => {
    const set = new Set<string>([
      "md",
      "json",
      "yaml",
      "yml",
      "log",
      "txt",
      "folder",
      "unknown",
    ]);
    (artifactsResponse?.data ?? []).forEach((a) => {
      const t = (a.contentType ?? "").trim().toLowerCase();
      if (t) set.add(t);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [artifactsResponse?.data]);

  const totalItems = artifactsResponse?.pagination?.totalItems;
  const totalPages = artifactsResponse?.pagination?.totalPages;
  const artifacts = React.useMemo(() => {
    return artifactsResponse?.data ?? [];
  }, [artifactsResponse?.data]);

  const filteredArtifacts = React.useMemo(() => {
    let items = artifacts;
    const ct = (selectedContentType ?? "all").trim().toLowerCase();
    if (ct && ct !== "all") {
      items = items.filter((a) => (a.contentType ?? "").trim().toLowerCase() === ct);
    }
    const q = (search ?? "").trim().toLowerCase();
    if (q) {
      items = items.filter((a) => {
        const hay = [
          a.name,
          a.workspace,
          a.artifactType,
          a.contentType,
          a.artifactPath,
          a.description,
          a.runId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return items;
  }, [artifacts, search, selectedContentType]);

  const hasActiveFilters =
    selectedWorkspace !== "all" ||
    selectedArtifactType !== "all" ||
    selectedContentType !== "all" ||
    !!search.trim();

  const handleSort = React.useCallback((field: ArtifactSortField) => {
    setSortState((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const compareArtifacts = React.useCallback(
    (a: Artifact, b: Artifact, field: ArtifactSortField, direction: SortDirection) => {
      const factor = direction === "asc" ? 1 : -1;
      const readField = (value: Artifact) => {
        if (field === "actions") return value.name;
        return value[field];
      };
      const av = readField(a);
      const bv = readField(b);
      let cmp = 0;

      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }

      if (cmp === 0) {
        cmp = a.id.localeCompare(b.id);
      }

      return cmp * factor;
    },
    []
  );

  const groupedArtifacts = React.useMemo(() => {
    const groups = new Map<string, Artifact[]>();
    filteredArtifacts.forEach((a) => {
      const key = (a.workspace ?? "").trim() || "unknown";
      const list = groups.get(key);
      if (list) {
        list.push(a);
      } else {
        groups.set(key, [a]);
      }
    });

    const keys = Array.from(groups.keys()).sort((a, b) => {
      const cmp = a.localeCompare(b);
      if (sortState.field === "workspace") {
        return cmp * (sortState.direction === "asc" ? 1 : -1);
      }
      return cmp;
    });

    return keys.map((key) => {
      const items = groups.get(key) ?? [];
      const sortedItems = sortState.field
        ? [...items].sort((a, b) =>
            compareArtifacts(a, b, sortState.field as ArtifactSortField, sortState.direction)
          )
        : items;
      return { workspace: key, items: sortedItems };
    });
  }, [compareArtifacts, filteredArtifacts, sortState]);

  const toggleWorkspaceCollapse = React.useCallback((workspace: string) => {
    setCollapsedWorkspaces((prev) => ({
      ...prev,
      [workspace]: !prev[workspace],
    }));
  }, []);

  const contentLanguage = React.useMemo(() => {
    return inferLanguageForArtifact(selectedArtifact);
  }, [selectedArtifact]);

  const reportSrcDoc = React.useMemo(() => {
    if (!selectedArtifact) return "";
    if (!isHtmlArtifact(selectedArtifact)) return "";
    return buildReportSrcDoc(contentText);
  }, [contentText, selectedArtifact]);

  React.useEffect(() => {
    if (!selectedArtifact) return;
    if (selectedArtifact.contentType === "folder") return;
    if (contentLoading) return;
    if (contentText || contentError) return;
    void loadArtifactContent(selectedArtifact);
  }, [contentError, contentLoading, contentText, loadArtifactContent, selectedArtifact]);

  React.useEffect(() => {
    if (!selectedArtifact) return;
    if (detailTab !== "render") return;
    if (!isMarkdownArtifact(selectedArtifact) && !isHtmlArtifact(selectedArtifact)) return;
    if (contentLoading) return;
    if (contentText || contentError) return;
    void loadArtifactContent(selectedArtifact);
  }, [contentError, contentLoading, contentText, detailTab, loadArtifactContent, selectedArtifact]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">产物清单</CardTitle>
              <CardDescription>
                {typeof totalItems === "number" ? (
                  <>
                    <span className="font-medium text-foreground">
                      {totalItems.toLocaleString()}
                    </span>{" "}
                    个产物
                    {selectedWorkspace !== "all" && (
                      <>
                        {"，工作区："}
                        <span className="font-medium text-foreground">
                          {selectedWorkspace}
                        </span>
                      </>
                    )}
                    {selectedArtifactType !== "all" && (
                      <>
                        {"，类型："}
                        <span className="font-medium text-foreground">
                          {selectedArtifactType}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  "正在加载产物……"
                )}
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 sm:items-end">
              <div className="flex items-center justify-end gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className={
                    verifyExistOnly
                      ? "border-success/40 bg-success-soft text-success hover:bg-success-soft hover:text-success"
                      : "border-warning/40 bg-warning-soft text-warning hover:bg-warning-soft hover:text-warning"
                  }
                  onClick={() => {
                    setVerifyExistOnly((v) => !v);
                    setSelectedArtifact(null);
                    setPage(1);
                    forceNextRef.current = true;
                  }}
                  disabled={isLoading}
                >
                  <BookCheckIcon className="size-4" />
                  仅显示存在的文件
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadArtifacts()}
                  disabled={isLoading}
                >
                  <RefreshCcwIcon
                    className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                  />
                  刷新
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-3 w-full justify-end">
                <div className="relative w-full sm:w-[260px] lg:w-[280px] shrink-0">
                  <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索产物……"
                    className="pl-9"
                  />
                </div>

                <Select
                  value={selectedWorkspace}
                  onValueChange={(v) => {
                    setSelectedWorkspace(v);
                    setPage(1);
                    forceNextRef.current = true;
                  }}
                >
                  <SelectTrigger className="w-full sm:w-56">
                    <div className="flex items-center gap-2 flex-1">
                      <FolderOpenIcon className="size-4 text-muted-foreground" />
                      <SelectValue placeholder="选择工作区" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部工作区</SelectItem>
                    {workspaceOptions.map((ws) => (
                      <SelectItem key={ws} value={ws}>
                        {ws}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedArtifactType}
                  onValueChange={(v) => {
                    setSelectedArtifactType(v);
                    setPage(1);
                    forceNextRef.current = true;
                  }}
                >
                  <SelectTrigger className="w-48">
                    <div className="flex items-center gap-2 flex-1">
                      <TagIcon className="size-4 text-muted-foreground" />
                      <SelectValue placeholder="产物类型" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部产物类型</SelectItem>
                    {artifactTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedContentType}
                  onValueChange={(v) => {
                    setSelectedContentType(v);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <div className="flex items-center gap-2 flex-1">
                      <FileTextIcon className="size-4 text-muted-foreground" />
                      <SelectValue placeholder="内容类型" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部内容类型</SelectItem>
                    {contentTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {selectedArtifact ? (
            <div className="p-4 pt-0">
              <Tabs value={detailTab} onValueChange={setDetailTab} className="mt-0 flex flex-col h-[calc(100vh-17rem)]">
                <div className="border-b pb-1 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedArtifact(null);
                      setContentLoading(false);
                      setContentError("");
                      setContentText("");
                      setDetailTab("details");
                    }}
                  >
                    <ChevronLeftIcon className="size-4" />
                    返回
                  </Button>
                  <TabsList>
                    <TabsTrigger value="details">详情</TabsTrigger>
                    <TabsTrigger value="content">内容</TabsTrigger>
                    <TabsTrigger value="render">渲染报告</TabsTrigger>
                  </TabsList>

                  <div className="ml-auto flex items-center gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <ArchiveIcon className="size-4" />
                        <span>产物</span>
                      </div>
                      <div className="text-sm font-medium truncate">{selectedArtifact.name}</div>
                      <Badge variant={artifactTypeVariant(selectedArtifact.artifactType)} className="font-mono">
                        {selectedArtifact.artifactType || "unknown"}
                      </Badge>
                      <Badge variant={contentTypeVariant(selectedArtifact.contentType)} className="font-mono">
                        {selectedArtifact.contentType || "unknown"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openContent(selectedArtifact)}
                        disabled={contentLoading}
                      >
                        <RefreshCcwIcon className={`mr-2 size-4 ${contentLoading ? "animate-spin" : ""}`} />
                        刷新产物内容
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(contentText);
                            toast.success("已复制到剪贴板");
                          } catch {
                            toast.error("复制失败");
                          }
                        }}
                        disabled={contentLoading || !contentText}
                      >
                        <ClipboardIcon className="mr-2 size-4" />
                        复制
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openArtifactInNewTab(selectedArtifact)}
                      >
                        <ExternalLinkIcon className="mr-2 size-4" />
                        在新标签页打开原始内容
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const name = inferDownloadName(selectedArtifact);
                          const blob = new Blob([contentText], {
                            type: inferMime(selectedArtifact.contentType),
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = name;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                        }}
                        disabled={contentLoading || !contentText}
                      >
                        <DownloadIcon className="mr-2 size-4" />
                        下载
                      </Button>
                    </div>
                  </div>
                </div>

                <TabsContent value="details" className="flex-1 m-0 min-h-0">
                  <ScrollArea className="h-full">
                    <div className="pt-2 space-y-3 text-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="text-muted-foreground">工作区</div>
                          <div className="font-mono break-all">{selectedArtifact.workspace}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">运行 ID</div>
                          <div className="font-mono break-all">{selectedArtifact.runId || "-"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">产物类型</div>
                          <Badge variant={artifactTypeVariant(selectedArtifact.artifactType)} className="font-mono">
                            {selectedArtifact.artifactType || "unknown"}
                          </Badge>
                        </div>
                        <div>
                          <div className="text-muted-foreground">内容类型</div>
                          <Badge variant={contentTypeVariant(selectedArtifact.contentType)} className="font-mono">
                            {selectedArtifact.contentType || "unknown"}
                          </Badge>
                        </div>
                        <div>
                          <div className="text-muted-foreground">大小</div>
                          <div className="font-mono">{formatBytes(selectedArtifact.sizeBytes || 0)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">行数</div>
                          <div className="font-mono">{selectedArtifact.lineCount}</div>
                        </div>
                      </div>

                      {selectedArtifact.description ? (
                        <div>
                          <div className="text-muted-foreground">描述</div>
                          <div>{selectedArtifact.description}</div>
                        </div>
                      ) : null}

                      <div>
                        <div className="text-muted-foreground">产物路径</div>
                        <div className="font-mono text-xs break-all">{selectedArtifact.artifactPath}</div>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="content" className="flex-1 m-0 min-h-0">
                  <div className="flex flex-col h-full">
                    <div className="mt-2 rounded-md border bg-muted/20 overflow-hidden flex-1 min-h-0">
                      <ScrollArea className="h-full">
                        <div className="p-4">
                          {contentLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <LoaderIcon className="size-4 animate-spin" />
                              加载中……
                            </div>
                          ) : contentError ? (
                            <div className="text-sm text-destructive whitespace-pre-wrap break-words">
                              {contentError}
                            </div>
                          ) : contentText ? (
                            <CodeHighlighter
                              language={contentLanguage}
                              style={resolvedTheme === "dark" ? atomOneDark : github}
                              customStyle={{
                                margin: 0,
                                background: "transparent",
                                fontSize: "0.8rem",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                              codeTagProps={{
                                style: {
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                },
                              }}
                            >
                              {contentText}
                            </CodeHighlighter>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              点击“刷新产物内容”查看产物数据。
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="render" className="flex-1 m-0 min-h-0">
                  <div className="flex flex-col h-full">
                    <div className="mt-2 rounded-md border bg-muted/20 overflow-hidden flex-1 min-h-0">
                      {isHtmlArtifact(selectedArtifact) ? (
                        contentLoading ? (
                          <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                            <LoaderIcon className="size-4 animate-spin" />
                            加载中……
                          </div>
                        ) : contentError ? (
                          <div className="p-4 text-sm text-destructive whitespace-pre-wrap break-words">
                            {contentError}
                          </div>
                        ) : !contentText ? (
                          <div className="p-4 text-sm text-muted-foreground">
                            点击“刷新产物内容”渲染报告。
                          </div>
                        ) : (
                          <iframe
                            className="w-full h-full bg-transparent"
                            sandbox=""
                            referrerPolicy="no-referrer"
                            srcDoc={reportSrcDoc}
                          />
                        )
                      ) : isMarkdownArtifact(selectedArtifact) ? (
                        <ScrollArea className="h-full">
                          <div className="p-4 text-sm">
                            {contentLoading ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderIcon className="size-4 animate-spin" />
                                加载中……
                              </div>
                            ) : contentError ? (
                              <div className="text-sm text-destructive whitespace-pre-wrap break-words">
                                {contentError}
                              </div>
                            ) : !contentText ? (
                              <div className="text-sm text-muted-foreground">
                                点击“刷新产物内容”渲染报告。
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <ReactMarkdown
                                  components={{
                                    h1: (props) => (
                                      <h1 {...props} className="text-xl font-semibold" />
                                    ),
                                    h2: (props) => (
                                      <h2 {...props} className="text-lg font-semibold" />
                                    ),
                                    h3: (props) => (
                                      <h3 {...props} className="text-base font-semibold" />
                                    ),
                                    p: (props) => (
                                      <p {...props} className="leading-relaxed" />
                                    ),
                                    ul: (props) => (
                                      <ul {...props} className="list-disc pl-6 space-y-1" />
                                    ),
                                    ol: (props) => (
                                      <ol {...props} className="list-decimal pl-6 space-y-1" />
                                    ),
                                    li: (props) => <li {...props} className="leading-relaxed" />,
                                    a: (props) => (
                                      <a
                                        {...props}
                                        className="text-primary underline underline-offset-4"
                                        target="_blank"
                                        rel="noreferrer"
                                      />
                                    ),
                                    code: (props) => (
                                      <code
                                        {...props}
                                        className="rounded bg-muted px-1 py-0.5 font-mono text-xs"
                                      />
                                    ),
                                    pre: (props) => (
                                      <pre
                                        {...props}
                                        className="rounded-md border bg-background p-3 overflow-x-auto"
                                      />
                                    ),
                                    blockquote: (props) => (
                                      <blockquote
                                        {...props}
                                        className="border-l-2 pl-3 text-muted-foreground"
                                      />
                                    ),
                                  }}
                                >
                                  {contentText}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="p-4 text-sm text-muted-foreground">
                          报告渲染支持 HTML 或 Markdown 产物。
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : isLoading && artifacts.length === 0 ? (
            <div className="p-6">
              <TableSkeleton rows={10} columns={6} />
            </div>
          ) : filteredArtifacts.length === 0 ? (
            <div className="min-h-[360px] flex items-center justify-center">
              <EmptyState
                icon={hasActiveFilters ? SearchXIcon : ArchiveIcon}
                title={hasActiveFilters ? "没有匹配的产物" : "未找到产物"}
                description={
                  hasActiveFilters
                    ? "没有产物符合当前筛选条件，请调整搜索词、工作区、产物类型或内容类型。"
                    : "扫描任务生成报告、日志或状态文件后，产物将显示在这里。"
                }
              />
            </div>
          ) : (
            <div className="space-y-4 relative">
                {isLoading && (
                  <div className="absolute inset-0 bg-background/50 z-20 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background px-3 py-2 rounded-md shadow-sm border">
                      <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      刷新中……
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <Table className="table-fixed">
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <SortableTableHead
                          field="name"
                          currentSort={sortState}
                          onSort={(f) => handleSort(f as ArtifactSortField)}
                          className="w-[220px]"
                        >
                          名称
                        </SortableTableHead>
                        <SortableTableHead
                          field="workspace"
                          currentSort={sortState}
                          onSort={(f) => handleSort(f as ArtifactSortField)}
                          className="w-[190px]"
                        >
                          工作区
                        </SortableTableHead>
                        <SortableTableHead
                          field="artifactType"
                          currentSort={sortState}
                          onSort={(f) => handleSort(f as ArtifactSortField)}
                          className="w-[160px]"
                        >
                          产物类型
                        </SortableTableHead>
                        <SortableTableHead
                          field="contentType"
                          currentSort={sortState}
                          onSort={(f) => handleSort(f as ArtifactSortField)}
                          className="w-[160px]"
                        >
                          内容类型
                        </SortableTableHead>
                        <SortableTableHead
                          field="sizeBytes"
                          currentSort={sortState}
                          onSort={(f) => handleSort(f as ArtifactSortField)}
                          className="w-[140px]"
                        >
                          大小
                        </SortableTableHead>
                        <SortableTableHead
                          field="actions"
                          currentSort={sortState}
                          onSort={(f) => handleSort(f as ArtifactSortField)}
                          className="w-[120px] text-center"
                        >
                          操作
                        </SortableTableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence initial={false} mode="popLayout">
                        {groupedArtifacts.flatMap((group) => {
                          const isCollapsed = !!collapsedWorkspaces[group.workspace];
                          return [
                            <motion.tr
                              key={`group-${group.workspace}`}
                              data-slot="table-row"
                              layout="position"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.16, ease: "easeOut" }}
                              className="bg-muted/30"
                            >
                              <TableCell colSpan={6} className="py-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="rounded-md"
                                    onClick={() => toggleWorkspaceCollapse(group.workspace)}
                                    aria-label={`切换 ${group.workspace}`}
                                  >
                                    {isCollapsed ? (
                                      <ChevronRightIcon className="size-3.5" />
                                    ) : (
                                      <ChevronDownIcon className="size-3.5" />
                                    )}
                                  </Button>
                                  <FolderOpenIcon className="size-3.5" />
                                  <span className="font-mono">{group.workspace}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({group.items.length})
                                  </span>
                                </div>
                              </TableCell>
                            </motion.tr>,
                            ...(isCollapsed
                              ? []
                              : group.items.map((a) => (
                          <motion.tr
                            key={a.id}
                            data-slot="table-row"
                            layout="position"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="cursor-pointer border-b border-border-subtle transition-colors duration-150 hover:bg-sunken data-[state=selected]:bg-primary-wash"
                            onClick={() => openDetails(a)}
                          >
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{a.workspace}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={artifactTypeVariant(a.artifactType)}
                              className="font-mono"
                            >
                              {a.artifactType || "unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={contentTypeVariant(a.contentType)}
                              className="font-mono"
                            >
                              {a.contentType || "unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatBytes(a.sizeBytes || 0)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 w-full">
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className="rounded-md"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openContent(a);
                                }}
                                aria-label="获取内容"
                              >
                                <BookSearchIcon className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className="rounded-md"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openArtifactInNewTab(a);
                                }}
                                aria-label="在新标签页打开原始内容"
                              >
                                <ExternalLinkIcon className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                          </motion.tr>
                              ))),
                          ];
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>

                {typeof totalPages === "number" && totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      显示{" "}
                      <span className="font-medium text-foreground">
                        {(page - 1) * pageSize + 1}
                      </span>{" "}
                      至{" "}
                      <span className="font-medium text-foreground">
                        {Math.min(page * pageSize, totalItems ?? page * pageSize)}
                      </span>{" "}
                      共{" "}
                      <span className="font-medium text-foreground">
                        {(totalItems ?? 0).toLocaleString()}
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPage((p) => Math.max(1, p - 1));
                          forceNextRef.current = true;
                        }}
                        disabled={page <= 1 || isLoading}
                      >
                        <ChevronLeftIcon className="size-4" />
                        上一页
                      </Button>
                      <div className="text-sm text-muted-foreground px-2">
                        页{" "}
                        <span className="font-medium text-foreground">{page}</span> /{" "}
                        <span className="font-medium text-foreground">{totalPages}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPage((p) => Math.min(totalPages, p + 1));
                          forceNextRef.current = true;
                        }}
                        disabled={page >= totalPages || isLoading}
                      >
                        下一页
                        <ChevronRightIcon className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
