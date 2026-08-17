"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "@/components/ui/table";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import type { UtilityFunction } from "@/lib/types/functions";
import { listUtilityFunctions, evalUtilityFunction } from "@/lib/api/functions";
import { toast } from "sonner";
import {
  LoaderIcon,
  PlayIcon,
  CopyIcon,
  TagsIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  Columns3Icon,
  ListOrderedIcon,
} from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import javascript from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import github from "react-syntax-highlighter/dist/esm/styles/hljs/github";
import atomOneDark from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";
import { useTheme } from "next-themes";

SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("json", json);

export default function UtilitiesPage() {
  const { resolvedTheme } = useTheme();
  type SortKey = "name" | "description" | "example" | "return_type" | "tags";

  const [functions, setFunctions] = React.useState<UtilityFunction[]>([]);
  const [availableTags, setAvailableTags] = React.useState<string[]>([]);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState<string>("");
  const [perPage, setPerPage] = React.useState<number>(5);
  const [page, setPage] = React.useState<number>(1);
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [visibleColumns, setVisibleColumns] = React.useState<Record<SortKey, boolean>>({
    name: true,
    description: true,
    example: true,
    return_type: true,
    tags: true,
  });
  const [loadingFuncs, setLoadingFuncs] = React.useState(true);
  const [script, setScript] = React.useState<string>("");
  const [target, setTarget] = React.useState<string>("");
  const [paramsText, setParamsText] = React.useState<string>("");
  const [paramsValid, setParamsValid] = React.useState<boolean>(true);
  const [runningEval, setRunningEval] = React.useState<boolean>(false);
  const [evalResult, setEvalResult] = React.useState<unknown>(undefined);
  const [renderedScript, setRenderedScript] = React.useState<string>("");

  React.useEffect(() => {
    const loadFunctions = async () => {
      try {
        setLoadingFuncs(true);
        const data = await listUtilityFunctions();
        setFunctions(data.functions);
        const tags = new Set<string>();
        for (const fn of data.functions) {
          for (const tag of fn.tags ?? []) tags.add(tag);
        }
        setAvailableTags(Array.from(tags).sort());
      } catch (e) {
        toast.error("加载实用函数失败", { description: e instanceof Error ? e.message : "" });
      } finally {
        setLoadingFuncs(false);
      }
    };
    loadFunctions();
  }, []);

  const filteredByTags = React.useMemo(() => {
    if (selectedTags.length === 0) return functions;
    return functions.filter((fn) => (fn.tags ?? []).some((t) => selectedTags.includes(t)));
  }, [functions, selectedTags]);

  const filteredFunctions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredByTags;
    return filteredByTags.filter((fn) => {
      const haystack = [
        fn.name,
        fn.description,
        fn.return_type,
        fn.example ?? "",
        (fn.tags ?? []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [filteredByTags, search]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const visibleColumnCount =
    Number(visibleColumns.name) +
    Number(visibleColumns.description) +
    Number(visibleColumns.example) +
    Number(visibleColumns.return_type) +
    Number(visibleColumns.tags);

  const setColumnChecked = (key: SortKey, checked: boolean) => {
    setVisibleColumns((prev) => {
      if (!checked) {
        const nextCount =
          Number(key === "name" ? false : prev.name) +
          Number(key === "description" ? false : prev.description) +
          Number(key === "example" ? false : prev.example) +
          Number(key === "return_type" ? false : prev.return_type) +
          Number(key === "tags" ? false : prev.tags);
        if (nextCount <= 0) return prev;
      }
      return { ...prev, [key]: checked };
    });
  };

  const sortedFunctions = React.useMemo(() => {
    const getValue = (fn: UtilityFunction): string => {
      switch (sortKey) {
        case "name":
          return fn.name;
        case "description":
          return fn.description;
        case "example":
          return fn.example ?? "";
        case "return_type":
          return fn.return_type;
        case "tags":
          return (fn.tags ?? []).join(",");
      }
    };

    const items = [...filteredFunctions];
    items.sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [filteredFunctions, sortDir, sortKey]);

  React.useEffect(() => {
    if (visibleColumns[sortKey]) return;
    const order: SortKey[] = ["name", "description", "example", "return_type", "tags"];
    const next = order.find((k) => visibleColumns[k]);
    if (next) setSortKey(next);
  }, [sortKey, visibleColumns]);

  React.useEffect(() => {
    setPage(1);
  }, [selectedTags, search, perPage, sortKey, sortDir]);

  const totalPages = React.useMemo(() => {
    return Math.max(1, Math.ceil(sortedFunctions.length / perPage));
  }, [perPage, sortedFunctions.length]);

  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const endIndexExclusive = Math.min(startIndex + perPage, sortedFunctions.length);
  const pageFunctions = React.useMemo(() => {
    return sortedFunctions.slice(startIndex, endIndexExclusive);
  }, [sortedFunctions, startIndex, endIndexExclusive]);

  const renderSortIcon = (key: SortKey) => {
    if (key !== sortKey) return <ArrowUpDownIcon className="size-3.5 opacity-70" />;
    return sortDir === "asc" ? (
      <ArrowUpIcon className="size-3.5 opacity-80" />
    ) : (
      <ArrowDownIcon className="size-3.5 opacity-80" />
    );
  };

  const badgeVariantForTag = (tag: string) => {
    const variants = ["info", "success", "warning", "purple", "pink", "cyan", "orange", "secondary"] as const;
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = (hash * 31 + tag.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % variants.length;
    return variants[idx];
  };

  const tagsLabel = React.useMemo(() => {
    if (selectedTags.length === 0) return "全部标签";
    if (selectedTags.length <= 2) return selectedTags.join(", ");
    return `${selectedTags.slice(0, 2).join(", ")} +${selectedTags.length - 2}`;
  }, [selectedTags]);

  const setTagChecked = (tag: string, checked: boolean) => {
    setSelectedTags((prev) => {
      if (checked) return Array.from(new Set([...prev, tag])).sort();
      return prev.filter((t) => t !== tag);
    });
  };

  const parseParams = (): Record<string, string> | undefined => {
    const trimmed = paramsText.trim();
    if (!trimmed) return undefined;
    try {
      const obj = JSON.parse(trimmed);
      const isObject = obj && typeof obj === "object" && !Array.isArray(obj);
      setParamsValid(isObject);
      return isObject ? (obj as Record<string, string>) : undefined;
    } catch {
      setParamsValid(false);
      return undefined;
    }
  };

  const buildCurl = (): string => {
    const endpoint = "/golish/api/functions/eval";
    const body: Record<string, unknown> = { script };
    if (target.trim()) body.target = target.trim();
    const p = parseParams();
    if (p && paramsValid) body.params = p;
    return `curl -X POST ${endpoint} \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body, null, 2)}'`;
  };

  const doEvalFunction = async () => {
    if (!script.trim()) {
      toast.error("请输入脚本");
      return;
    }
    const p = parseParams();
    if (!paramsValid) {
      toast.error("参数必须是有效的 JSON 对象");
      return;
    }
    setRunningEval(true);
    try {
      const resp = await evalUtilityFunction({
        script: script.trim(),
        target: target.trim() || undefined,
        params: p,
      });
      setEvalResult(resp.result);
      setRenderedScript(resp.rendered_script);
      toast.success("函数执行成功");
    } catch (e) {
      toast.error("执行失败", { description: e instanceof Error ? e.message : "" });
    } finally {
      setRunningEval(false);
    }
  };

  const copyFunctionName = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败");
    }
  };

  const syntaxStyle = resolvedTheme === "dark" ? atomOneDark : github;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListOrderedIcon className="size-5" />
            <span>实用函数列表</span>
          </CardTitle>
          <CardDescription>按类别查看所有可用的实用函数。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingFuncs ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderIcon className="size-4 animate-spin" />
              正在加载函数……
            </div>
          ) : functions.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无可用函数</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="search">搜索</Label>
                  <Input
                    id="search"
                    placeholder="按名称、描述或标签搜索……"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">标签</Label>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button id="tags" variant="outline" className="flex-1 justify-between rounded-md">
                          <span className="truncate">{tagsLabel}</span>
                          <TagsIcon className="size-4 opacity-70" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[340px] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">筛选</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={selectedTags.length === 0}
                            onClick={() => setSelectedTags([])}
                          >
                            清除
                          </Button>
                        </div>
                        <div className="mt-3 max-h-64 overflow-auto space-y-2 pr-1">
                          {availableTags.length === 0 ? (
                            <div className="text-sm text-muted-foreground">无标签</div>
                          ) : (
                            availableTags.map((tag) => (
                              <label key={tag} className="flex items-center gap-2">
                                <Checkbox
                                  checked={selectedTags.includes(tag)}
                                  onCheckedChange={(v) => setTagChecked(tag, v === true)}
                                />
                                <Badge variant={badgeVariantForTag(tag)} className="font-normal">
                                  {tag}
                                </Badge>
                              </label>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="shrink-0 rounded-md px-3">
                          <Columns3Icon className="size-4 opacity-70" />
                          <span>列</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[320px] p-3">
                        <div className="text-sm font-medium">显示列</div>
                        <div className="mt-3 space-y-2">
                          {([
                            ["name", "名称"],
                            ["description", "描述"],
                            ["example", "示例"],
                            ["return_type", "返回类型"],
                            ["tags", "标签"],
                          ] as const).map(([key, label]) => (
                            <label key={key} className="flex items-center justify-between gap-3">
                              <span className="text-sm">{label}</span>
                              <Checkbox
                                checked={visibleColumns[key]}
                                disabled={visibleColumns[key] && visibleColumnCount <= 1}
                                onCheckedChange={(v) => setColumnChecked(key, v === true)}
                              />
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="per-page">每页数量</Label>
                  <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
                    <SelectTrigger id="per-page" className="w-[92px]">
                      <SelectValue placeholder="10" />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 10, 15, 30, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Table className="table-fixed">
                <TableCaption>
                  显示 {sortedFunctions.length === 0 ? 0 : startIndex + 1}-{endIndexExclusive}，筛选后共 {sortedFunctions.length} 条（总计 {functions.length} 条）
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.name && (
                      <TableHead className="w-[260px]">
                        <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("name")}>
                          <span>名称</span>
                          {renderSortIcon("name")}
                        </button>
                      </TableHead>
                    )}
                    {visibleColumns.description && (
                      <TableHead className="w-[240px]">
                        <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("description")}>
                          <span>描述</span>
                          {renderSortIcon("description")}
                        </button>
                      </TableHead>
                    )}
                    {visibleColumns.example && (
                      <TableHead className="w-[220px]">
                        <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("example")}>
                          <span>示例</span>
                          {renderSortIcon("example")}
                        </button>
                      </TableHead>
                    )}
                    {visibleColumns.return_type && (
                      <TableHead className="w-[120px]">
                        <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("return_type")}>
                          <span>返回类型</span>
                          {renderSortIcon("return_type")}
                        </button>
                      </TableHead>
                    )}
                    {visibleColumns.tags && (
                      <TableHead className="w-[160px]">
                        <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("tags")}>
                          <span>标签</span>
                          {renderSortIcon("tags")}
                        </button>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageFunctions.map((fn) => (
                    <TableRow key={fn.name}>
                      {visibleColumns.name && (
                        <TableCell className="align-top w-[260px]">
                          <button
                            className="w-full rounded border border-border/60 bg-muted/30 px-2 py-1 -mx-1 cursor-pointer text-left transition-colors hover:bg-muted/50"
                            onClick={() => copyFunctionName(fn.name)}
                            title="点击复制"
                          >
                            <code className="block text-xs font-mono whitespace-pre-wrap break-words leading-snug">
                              {fn.name}
                            </code>
                          </button>
                        </TableCell>
                      )}
                      {visibleColumns.description && (
                        <TableCell className="text-sm text-muted-foreground align-top w-[240px]">{fn.description}</TableCell>
                      )}
                      {visibleColumns.example && (
                        <TableCell className="align-top">
                          {fn.example ? (
                            <SyntaxHighlighter
                              language="javascript"
                              style={syntaxStyle}
                              customStyle={{
                                background: "transparent",
                                padding: 0,
                                margin: 0,
                                fontSize: "0.7rem",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {fn.example}
                            </SyntaxHighlighter>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.return_type && (
                        <TableCell className="align-top">
                          <Badge variant="outline" className="font-mono font-normal">
                            {fn.return_type}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.tags && (
                        <TableCell className="align-top">
                          {(fn.tags ?? []).length === 0 ? (
                            <span className="text-sm text-muted-foreground">-</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(fn.tags ?? []).map((tag) => (
                                <Badge key={`${fn.name}:${tag}`} variant={badgeVariantForTag(tag)} className="font-normal">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="text-sm text-muted-foreground">
                  页 {currentPage} / {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PlayIcon className="size-5" />
            <span>执行实用函数</span>
          </CardTitle>
          <CardDescription>
            通过模板渲染和 JavaScript 执行实用函数脚本。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="script">脚本</Label>
            <textarea
              id="script"
              className="min-h-24 w-full rounded-md border bg-background p-3 text-sm font-mono resize-y"
              placeholder='例如：trim("  hello  ")'
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target">目标（可选）</Label>
              <Input
                id="target"
                placeholder="例如：/tmp/test.txt"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="params">参数（JSON，可选）</Label>
              <Input
                id="params"
                placeholder='例如：{"host":"localhost","port":"8080"}'
                value={paramsText}
                onChange={(e) => setParamsText(e.target.value)}
                className={!paramsValid ? "border-destructive" : ""}
              />
              {!paramsValid && (
                <p className="text-xs text-destructive">JSON 对象格式无效</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={doEvalFunction} disabled={runningEval}>
              {runningEval ? (
                <LoaderIcon className="mr-2 size-4 animate-spin" />
              ) : (
                <PlayIcon className="mr-2 size-4" />
              )}
              运行
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(buildCurl());
                  toast.success("Curl 命令已复制");
                } catch {
                  toast.error("复制 Curl 失败");
                }
              }}
            >
              <CopyIcon className="mr-2 size-4" />
              复制 Curl
            </Button>
          </div>

          {(renderedScript || evalResult !== undefined) && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>渲染后的脚本</Label>
                <SyntaxHighlighter
                  language="javascript"
                  style={syntaxStyle}
                  customStyle={{
                    borderRadius: "0.375rem",
                    border: "1px solid hsl(var(--border))",
                    padding: "0.75rem",
                    margin: 0,
                    fontSize: "0.875rem",
                    overflow: "auto",
                  }}
                >
                  {renderedScript || "—"}
                </SyntaxHighlighter>
              </div>
              <div className="space-y-2">
                <Label>结果</Label>
                <SyntaxHighlighter
                  language="json"
                  style={syntaxStyle}
                  customStyle={{
                    borderRadius: "0.375rem",
                    border: "1px solid hsl(var(--border))",
                    padding: "0.75rem",
                    margin: 0,
                    fontSize: "0.875rem",
                    overflow: "auto",
                    maxHeight: "16rem",
                  }}
                >
                  {evalResult === undefined ? "—" : JSON.stringify(evalResult, null, 2)}
                </SyntaxHighlighter>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
