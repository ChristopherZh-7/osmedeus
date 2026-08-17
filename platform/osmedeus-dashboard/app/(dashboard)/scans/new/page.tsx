"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchWorkflows } from "@/lib/api/workflows";
import { fetchWorkspaces } from "@/lib/api/assets";
import { createScan } from "@/lib/api/scans";
import { uploadTargetsFile } from "@/lib/api/uploads";
import type { Workflow } from "@/lib/types/workflow";
import type { Workspace } from "@/lib/types/asset";
import { toast } from "sonner";
import {
  LoaderIcon,
  InfoIcon,
  ChevronDownIcon,
  MousePointer2Icon,
  FolderIcon,
  TargetIcon,
  ListIcon,
  FileTextIcon,
  GaugeIcon,
  GlobeIcon,
  NetworkIcon,
  ZapIcon,
  UploadIcon,
  SlidersHorizontalIcon,
  PlusIcon,
  Trash2Icon,
  AlertTriangleIcon,
  TimerIcon,
  CpuIcon,
  ContainerIcon,
  ServerIcon,
  CalendarClockIcon,
  ClockIcon,
  XIcon,
  PlayIcon,
  Settings2Icon,
  CloudIcon,
  CloudUploadIcon,
  BeanOffIcon,
  ChevronsUpDownIcon,
  CheckIcon,
  SearchIcon,
} from "lucide-react";

export default function NewScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleParam = (searchParams.get("schedule") ?? "").toLowerCase();
  const scheduleFromUrl =
    scheduleParam === "1" || scheduleParam === "true" || scheduleParam === "yes";
  const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [workflowPickerOpen, setWorkflowPickerOpen] = React.useState(false);
  const [workflowSearch, setWorkflowSearch] = React.useState("");

  // Form state
  const [selectedWorkflow, setSelectedWorkflow] = React.useState("");
  const [selectedWorkspace, setSelectedWorkspace] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [targetMode, setTargetMode] = React.useState<"single" | "multiple" | "file" | "empty">("single");
  const [targetsText, setTargetsText] = React.useState("");
  const [uploadedFilePath, setUploadedFilePath] = React.useState("");
  const [concurrency, setConcurrency] = React.useState<1 | 2 | 3>(1);
  const [threadsHold, setThreadsHold] = React.useState<number>(10);
  const [heuristicsCheck, setHeuristicsCheck] = React.useState<"basic" | "advanced">("advanced");
  const [repeat, setRepeat] = React.useState<boolean>(true);
  const [repeatWaitTime, setRepeatWaitTime] = React.useState<string>("2h");
  const [params, setParams] = React.useState<Array<{ key: string; value: string }>>([]);
  const [priority, setPriority] = React.useState<"low" | "medium" | "high">("medium");
  const [timeout, setTimeoutVal] = React.useState("");
  const [runnerType, setRunnerType] = React.useState<"local" | "docker" | "ssh">("local");
  const [dockerImage, setDockerImage] = React.useState("");
  const [sshHost, setSshHost] = React.useState("");
  const [runMode, setRunMode] = React.useState<"local" | "distributed" | "cloud">("local");
  const [cloudProvider, setCloudProvider] = React.useState<string>("aws");
  const [cloudInstances, setCloudInstances] = React.useState<number>(1);
  const [cloudInstanceType, setCloudInstanceType] = React.useState("");
  const [cloudRegion, setCloudRegion] = React.useState("");
  const [cloudAutoDestroy, setCloudAutoDestroy] = React.useState(false);
  const [cloudReuseInfra, setCloudReuseInfra] = React.useState("");
  const [cloudUseSpot, setCloudUseSpot] = React.useState(false);
  const [enableSchedule, setEnableSchedule] = React.useState(scheduleFromUrl);
  const [cronExpression, setCronExpression] = React.useState("");
  const [cronError, setCronError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [workflowData, workspaceData] = await Promise.all([
          fetchWorkflows(),
          fetchWorkspaces(),
        ]);
        setWorkflows(workflowData);
        setWorkspaces(workspaceData);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("加载表单数据失败");
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, []);

  const filteredWorkflows = React.useMemo(() => {
    const q = workflowSearch.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter((wf) => {
      const haystack = `${wf.name} ${wf.kind} ${wf.description ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [workflowSearch, workflows]);

  const selectedWorkflowMeta = React.useMemo(() => {
    if (!selectedWorkflow) return null;
    return workflows.find((wf) => wf.name === selectedWorkflow) ?? null;
  }, [selectedWorkflow, workflows]);

  // Basic cron validation
  const validateCron = (cron: string): boolean => {
    if (!cron.trim()) {
      setCronError("启用定时任务后必须填写 Cron 表达式");
      return false;
    }

    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      setCronError("Cron 表达式必须包含 5 段（分钟、小时、日期、月份、星期）");
      return false;
    }

    setCronError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWorkflow) {
      toast.error("请选择工作流");
      return;
    }

    // Workspace is optional; it can prefill target

    // Validate target mode
    if (targetMode === "single") {
      if (!target.trim()) {
        toast.error("请输入目标");
        return;
      }
    } else if (targetMode === "multiple") {
      const lines = targetsText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => !!l);
      if (lines.length === 0) {
        toast.error("请至少输入一个目标");
        return;
      }
    } else if (targetMode === "file") {
      if (!uploadedFilePath.trim()) {
        toast.error("请上传目标文件");
        return;
      }
    } else if (targetMode === "empty") {
      // no validation
    }

    if (enableSchedule && !validateCron(cronExpression)) {
      return;
    }

    setIsSubmitting(true);

    try {
      const wf = workflows.find((w) => w.name === selectedWorkflow);
      const payload: any = {
        workflowId: selectedWorkflow,
        workflowKind: wf?.kind || "flow",
        workspaceId: selectedWorkspace || undefined,
        schedule: enableSchedule ? cronExpression.trim() : undefined,
      };
      if (!enableSchedule) {
        if (Number.isFinite(threadsHold) && threadsHold > 0) {
          payload.threads_hold = threadsHold;
        }
        payload.heuristics_check = heuristicsCheck;
        payload.repeat = repeat;
        if (repeat && repeatWaitTime.trim()) {
          payload.repeat_wait_time = repeatWaitTime.trim();
        }

        if (targetMode === "single") {
          payload.target = target.trim();
        } else if (targetMode === "multiple") {
          payload.targets = targetsText
            .split(/\r?\n/)
            .map((l: string) => l.trim())
            .filter((l: string) => !!l);
          payload.concurrency = concurrency;
        } else if (targetMode === "file") {
          payload.target_file = uploadedFilePath.trim();
          payload.concurrency = concurrency;
        } else if (targetMode === "empty") {
          payload.empty_target = true;
        }
        const paramsObj: Record<string, string> = {};
        params.forEach((p) => {
          const k = p.key.trim();
          const v = p.value.trim();
          if (k && v) paramsObj[k] = v;
        });
        if (Object.keys(paramsObj).length > 0) {
          payload.params = paramsObj;
        }
        payload.priority = priority;
        if (timeout.trim()) {
          payload.timeout = timeout.trim();
        }
        if (runnerType !== "local") {
          payload.runner_type = runnerType;
          if (runnerType === "docker" && dockerImage.trim()) {
            payload.docker_image = dockerImage.trim();
          }
          if (runnerType === "ssh" && sshHost.trim()) {
            payload.ssh_host = sshHost.trim();
          }
        }
        payload.run_mode = runMode;
        if (runMode === "cloud") {
          payload.cloud_provider = cloudProvider;
          if (cloudInstances > 0) payload.cloud_instances = cloudInstances;
          if (cloudInstanceType.trim()) payload.cloud_instance_type = cloudInstanceType.trim();
          if (cloudRegion.trim()) payload.cloud_region = cloudRegion.trim();
          if (cloudAutoDestroy) payload.cloud_auto_destroy = true;
          if (cloudUseSpot) payload.cloud_use_spot = true;
          if (cloudReuseInfra.trim()) payload.cloud_reuse_infra = cloudReuseInfra.trim();
        }
      }
      await createScan(payload);

      toast.success("扫描已成功启动", {
        description: enableSchedule
          ? "扫描计划任务已创建。"
          : "扫描正在运行。",
      });

      router.push(enableSchedule ? "/schedules" : "/scans");
    } catch (error) {
      toast.error("启动扫描失败", {
        description: error instanceof Error ? error.message : "请重试。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="m-4 lg:m-6">
      <Card className="rounded-xl overflow-hidden">
        <CardHeader className="border-b pb-4">
          <CardTitle>扫描配置</CardTitle>
          <CardDescription className="pb-1">
            选择工作流，配置目标和参数，并可按需设置计划任务
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="w-full space-y-6 p-4 lg:p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <MousePointer2Icon className="size-4" />
                工作流
              </span>
              <Separator className="flex-1" />
            </div>

		    {/* Workflow Selection */}
		    <div className="grid gap-4 md:grid-cols-3 md:items-end">
		      <div className="space-y-2 md:col-span-2">
		        <Popover open={workflowPickerOpen} onOpenChange={setWorkflowPickerOpen}>
		          <PopoverTrigger asChild>
		            <Button
		              id="workflow"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-label="工作流"
                      aria-expanded={workflowPickerOpen}
                      disabled={isLoadingData}
                      className="w-full justify-between"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <MousePointer2Icon className="size-4 text-muted-foreground" />
                        {selectedWorkflowMeta ? (
                          <span className="truncate">
                            {selectedWorkflowMeta.name}{" "}
                            <span className="text-xs text-muted-foreground">({selectedWorkflowMeta.kind})</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">选择工作流</span>
                        )}
                      </span>
                      <ChevronsUpDownIcon className="size-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <SearchIcon className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="搜索工作流……"
                          value={workflowSearch}
                          onChange={(e) => setWorkflowSearch(e.target.value)}
                          className="h-8 pl-8"
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-[280px]">
                      <div className="p-2 space-y-1">
                        {filteredWorkflows.map((wf) => {
                          const isSelected = wf.name === selectedWorkflow;
                          return (
                            <button
                              key={wf.name}
                              type="button"
                              onClick={() => {
                                setSelectedWorkflow(wf.name);
                                setWorkflowPickerOpen(false);
                                setWorkflowSearch("");
                              }}
                              className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-muted"
                            >
                              <div className="flex items-start gap-2">
                                <span className="mt-0.5 flex size-4 items-center justify-center">
                                  {isSelected ? <CheckIcon className="size-4" /> : null}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm">
                                    {wf.name}{" "}
                                    <span className="text-xs text-muted-foreground">({wf.kind})</span>
                                  </div>
                                  {wf.description ? (
                                    <div className="truncate text-xs text-muted-foreground">
                                      {wf.description}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        {filteredWorkflows.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-6">
                            未找到工作流
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>

		      <div className="flex flex-wrap items-center gap-3 md:col-span-1">
		        <Label htmlFor="target_mode" className="flex items-center gap-2 whitespace-nowrap">
		          <TargetIcon className="size-4 text-muted-foreground" />
		          目标模式
		        </Label>
		        <Select value={targetMode} onValueChange={(v) => setTargetMode(v as any)}>
		          <SelectTrigger
		            id="target_mode"
		            className="flex-1 min-w-[220px] md:flex-none md:w-[220px] rounded-full"
		            aria-label="目标模式"
		          >
		            <SelectValue placeholder="选择模式" />
		          </SelectTrigger>
		            <SelectContent>
		              <SelectItem value="single">
		                <span className="flex items-center gap-2">
		                  <TargetIcon className="size-4 text-muted-foreground" />
                          单个目标
                        </span>
                      </SelectItem>
                      <SelectItem value="multiple">
                        <span className="flex items-center gap-2">
                          <ListIcon className="size-4 text-muted-foreground" />
                          多个目标
                        </span>
                      </SelectItem>
                      <SelectItem value="file">
                        <span className="flex items-center gap-2">
                          <CloudUploadIcon className="size-4 text-muted-foreground" />
                          从文件读取
                        </span>
                      </SelectItem>
                      <SelectItem value="empty">
                        <span className="flex items-center gap-2">
                          <BeanOffIcon className="size-4 text-muted-foreground" />
                          无目标
                        </span>
                      </SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <TargetIcon className="size-4" />
                目标
              </span>
              <Separator className="flex-1" />
            </div>

            {/* Target Inputs */}
            {targetMode === "single" && (
              <div className="space-y-2">
                <Input
                  id="target"
                  type="text"
                  aria-label="目标"
                  placeholder="example.com"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  disabled={isLoadingData}
                />
                <p className="text-xs text-muted-foreground">要扫描的域名或 IP 地址</p>
              </div>
            )}
            {targetMode === "multiple" && (
              <div className="space-y-2">
                <Label htmlFor="targets" className="flex items-center gap-2">
                  <ListIcon className="size-4 text-muted-foreground" />
                  目标（每行一个）
                </Label>
                <textarea
                  id="targets"
                  value={targetsText}
                  onChange={(e) => setTargetsText(e.target.value)}
                  className="min-h-32 w-full rounded-md border bg-background p-2 text-sm"
                  placeholder="example.com\ndemo.com"
                />
                <div className="flex items-center gap-3">
                  <Label htmlFor="concurrency" className="flex items-center gap-2 whitespace-nowrap">
                    <GaugeIcon className="size-4 text-muted-foreground" />
                    并发数
                  </Label>
                  <Select value={String(concurrency)} onValueChange={(v) => setConcurrency(Number(v) as 1 | 2 | 3)}>
                    <SelectTrigger id="concurrency" className="h-9 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {targetMode === "file" && (
              <div className="space-y-2">
                <Label htmlFor="file" className="flex items-center gap-2">
                  <UploadIcon className="size-4 text-muted-foreground" />
                  上传目标文件
                </Label>
                <input
                  id="file"
                  type="file"
                  accept=".txt"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const info = await uploadTargetsFile(f);
                      setUploadedFilePath(info.path);
                      toast.success("文件已上传", { description: info.filename });
                    } catch (err) {
                      toast.error("上传失败", { description: err instanceof Error ? err.message : "" });
                    }
                  }}
                />
                {uploadedFilePath ? (
                  <p className="text-xs text-muted-foreground">服务器路径： {uploadedFilePath}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">文本文件，每行一个目标</p>
                )}
                <div className="flex items-center gap-3">
                  <Label htmlFor="concurrency-file" className="flex items-center gap-2 whitespace-nowrap">
                    <GaugeIcon className="size-4 text-muted-foreground" />
                    并发数
                  </Label>
                  <Select value={String(concurrency)} onValueChange={(v) => setConcurrency(Number(v) as 1 | 2 | 3)}>
                    <SelectTrigger id="concurrency-file" className="h-9 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {targetMode === "empty" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">本次扫描不会传入目标</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="priority" className="flex items-center gap-2">
                  <AlertTriangleIcon className="size-4 text-muted-foreground" />
                  优先级
                </Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as any)}
                  disabled={enableSchedule}
                >
                  <SelectTrigger id="priority" className="h-9">
                    <SelectValue placeholder="选择优先级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeout" className="flex items-center gap-2">
                  <TimerIcon className="size-4 text-muted-foreground" />
                  超时时间
                </Label>
                <Input
                  id="timeout"
                  type="text"
                  placeholder="例如：30s、45m、6h"
                  value={timeout}
                  onChange={(e) => setTimeoutVal(e.target.value)}
                  disabled={enableSchedule}
                  className="h-9"
                />
              </div>
              {/* Run Mode / Environment */}
              <div className="space-y-2">
                <Label htmlFor="run_mode" className="flex items-center gap-2">
                  <GlobeIcon className="size-4 text-muted-foreground" />
                  运行环境
                </Label>
                <Select
                  value={runMode}
                  onValueChange={(v) => setRunMode(v as any)}
                  disabled={enableSchedule}
                >
                  <SelectTrigger id="run_mode" className="h-9">
                    <SelectValue placeholder="选择运行环境" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">
                      <span className="flex items-center gap-2">
                        <CpuIcon className="size-4 text-muted-foreground" />
                        本地
                      </span>
                    </SelectItem>
                    <SelectItem value="distributed">
                      <span className="flex items-center gap-2">
                        <NetworkIcon className="size-4 text-muted-foreground" />
                        分布式
                      </span>
                    </SelectItem>
                    <SelectItem value="cloud">
                      <span className="flex items-center gap-2">
                        <CloudIcon className="size-4 text-muted-foreground" />
                        云端
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {runMode === "cloud" && (
              <div className="space-y-4 rounded-card border border-info/25 bg-info-soft/40 p-4">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-info">
                  <CloudIcon className="size-4" />
                  云环境配置
                </span>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cloud_provider" className="flex items-center gap-2">
                      <CloudIcon className="size-4 text-muted-foreground" />
                      云服务商
                    </Label>
                    <Select value={cloudProvider} onValueChange={setCloudProvider}>
                      <SelectTrigger id="cloud_provider" className="h-9">
                        <SelectValue placeholder="选择云服务商" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aws">AWS</SelectItem>
                        <SelectItem value="gcp">GCP</SelectItem>
                        <SelectItem value="digitalocean">DigitalOcean</SelectItem>
                        <SelectItem value="linode">Linode</SelectItem>
                        <SelectItem value="azure">Azure</SelectItem>
                        <SelectItem value="hetzner">Hetzner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cloud_instances" className="flex items-center gap-2">
                      <ServerIcon className="size-4 text-muted-foreground" />
                      实例数量
                    </Label>
                    <Input
                      id="cloud_instances"
                      type="number"
                      min={1}
                      placeholder="1"
                      value={cloudInstances}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setCloudInstances(Number.isFinite(v) && v > 0 ? v : 1);
                      }}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cloud_instance_type" className="flex items-center gap-2">
                      <CpuIcon className="size-4 text-muted-foreground" />
                      实例类型
                    </Label>
                    <Input
                      id="cloud_instance_type"
                      type="text"
                      placeholder={cloudProvider === "aws" ? "t3.medium" : cloudProvider === "digitalocean" ? "s-2vcpu-4gb" : "默认组织"}
                      value={cloudInstanceType}
                      onChange={(e) => setCloudInstanceType(e.target.value)}
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">留空以使用服务商默认值</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cloud_region" className="flex items-center gap-2">
                      <GlobeIcon className="size-4 text-muted-foreground" />
                      区域
                    </Label>
                    <Input
                      id="cloud_region"
                      type="text"
                      placeholder={cloudProvider === "aws" ? "ap-southeast-1" : cloudProvider === "digitalocean" ? "sgp1" : "默认组织"}
                      value={cloudRegion}
                      onChange={(e) => setCloudRegion(e.target.value)}
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">留空以使用服务商默认值</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="cloud_auto_destroy" className="flex items-center gap-2">
                        <TimerIcon className="size-4 text-muted-foreground" />
                        自动销毁
                      </Label>
                      <p className="text-xs text-muted-foreground">扫描完成后销毁基础设施</p>
                    </div>
                    <Switch id="cloud_auto_destroy" checked={cloudAutoDestroy} onCheckedChange={setCloudAutoDestroy} />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="cloud_use_spot" className="flex items-center gap-2">
                        <ZapIcon className="size-4 text-muted-foreground" />
                        竞价实例
                      </Label>
                      <p className="text-xs text-muted-foreground">使用竞价/抢占式实例以节省成本</p>
                    </div>
                    <Switch id="cloud_use_spot" checked={cloudUseSpot} onCheckedChange={setCloudUseSpot} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cloud_reuse_infra" className="flex items-center gap-2">
                    <ServerIcon className="size-4 text-muted-foreground" />
                    复用基础设施 ID
                  </Label>
                  <Input
                    id="cloud_reuse_infra"
                    type="text"
                    placeholder="可选：现有基础设施 ID"
                    value={cloudReuseInfra}
                    onChange={(e) => setCloudReuseInfra(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-xs text-muted-foreground">复用现有云基础设施，不再新建</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Settings2Icon className="size-4" />
                附加配置
              </span>
              <Separator className="flex-1" />
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Settings2Icon className="size-4" />
                    附加配置
                  </span>
                  <ChevronDownIcon
                    className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="workspace" className="flex items-center gap-2">
                    <FolderIcon className="size-4 text-muted-foreground" />
                    工作区
                  </Label>
                  <Select
                    value={selectedWorkspace}
                    onValueChange={(value) => {
                      setSelectedWorkspace(value);
                      const ws = workspaces.find((w) => String(w.id) === value);
                      if (ws) {
                        setTarget(ws.name);
                      }
                    }}
                    disabled={isLoadingData}
                  >
                    <SelectTrigger id="workspace">
                      <SelectValue placeholder="可选：选择工作区以自动填充目标" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map((ws) => (
                        <SelectItem key={ws.id} value={String(ws.id)}>
                          <div className="flex flex-col items-start">
                            <span>{ws.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {ws.local_path}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
                    参数
                  </Label>
                  <div className="space-y-2">
                    {params.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          placeholder="键"
                          value={p.key}
                          onChange={(e) => {
                            const next = params.slice();
                            next[idx] = { ...next[idx], key: e.target.value };
                            setParams(next);
                          }}
                          className="w-40"
                        />
                        <Input
                          placeholder="值"
                          value={p.value}
                          onChange={(e) => {
                            const next = params.slice();
                            next[idx] = { ...next[idx], value: e.target.value };
                            setParams(next);
                          }}
                          className="w-56"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const next = params.slice();
                            next.splice(idx, 1);
                            setParams(next);
                          }}
                        >
                          <Trash2Icon className="mr-2 size-4" />
                          移除
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setParams([...params, { key: "", value: "" }])}
                    >
                      <PlusIcon className="mr-2 size-4" />
                      添加参数
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="threads_hold" className="flex items-center gap-2">
                      <GaugeIcon className="size-4 text-muted-foreground" />
                      线程保持
                    </Label>
                    <Input
                      id="threads_hold"
                      type="number"
                      min={1}
                      placeholder="10"
                      value={threadsHold}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setThreadsHold(Number.isFinite(v) ? v : 10);
                      }}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="heuristics_check" className="flex items-center gap-2">
                      <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
                      启发式检查
                    </Label>
                    <Select value={heuristicsCheck} onValueChange={(v) => setHeuristicsCheck(v as any)}>
                      <SelectTrigger id="heuristics_check" className="h-9">
                        <SelectValue placeholder="选择模式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">基础</SelectItem>
                        <SelectItem value="advanced">高级</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="repeat" className="flex items-center gap-2">
                        <CalendarClockIcon className="size-4 text-muted-foreground" />
                        重复执行
                      </Label>
                      <p className="text-xs text-muted-foreground">等待指定时间后重新启动扫描</p>
                    </div>
                    <Switch id="repeat" checked={repeat} onCheckedChange={setRepeat} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="repeat_wait_time" className="flex items-center gap-2">
                      <ClockIcon className="size-4 text-muted-foreground" />
                      重复等待时间
                    </Label>
                    <Input
                      id="repeat_wait_time"
                      type="text"
                      placeholder="2h"
                      value={repeatWaitTime}
                      onChange={(e) => setRepeatWaitTime(e.target.value)}
                      disabled={!repeat}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="runner" className="flex items-center gap-2">
                    <CpuIcon className="size-4 text-muted-foreground" />
                    运行器类型
                  </Label>
                  <Select value={runnerType} onValueChange={(v) => setRunnerType(v as any)}>
                    <SelectTrigger id="runner" className="h-9">
                      <SelectValue placeholder="选择运行器" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">本地</SelectItem>
                      <SelectItem value="docker">Docker</SelectItem>
                      <SelectItem value="ssh">SSH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  {runnerType === "docker" && (
                    <div className="space-y-2">
                      <Label htmlFor="docker_image" className="flex items-center gap-2">
                        <ContainerIcon className="size-4 text-muted-foreground" />
                        Docker 镜像
                      </Label>
                      <Input
                        id="docker_image"
                        type="text"
                        placeholder="osmedeus/osmedeus:latest"
                        value={dockerImage}
                        onChange={(e) => setDockerImage(e.target.value)}
                      />
                    </div>
                  )}
                  {runnerType === "ssh" && (
                    <div className="space-y-2">
                      <Label htmlFor="ssh_host" className="flex items-center gap-2">
                        <ServerIcon className="size-4 text-muted-foreground" />
                        SSH 主机
                      </Label>
                      <Input
                        id="ssh_host"
                        type="text"
                        placeholder="worker1.example.com"
                        value={sshHost}
                        onChange={(e) => setSshHost(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <PlayIcon className="size-4" />
                执行扫描
              </span>
              <Separator className="flex-1" />
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-[240px] items-center justify-between gap-4 rounded-card border border-info/25 bg-info-soft/50 px-3 py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="schedule" className="flex items-center gap-2 text-info">
                      <CalendarClockIcon className="size-4 text-info" />
                      启用计划任务
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      按周期计划运行此扫描
                    </p>
                  </div>
                  <Switch
                    id="schedule"
                    checked={enableSchedule}
                    onCheckedChange={setEnableSchedule}
                    className="data-[state=checked]:bg-info data-[state=unchecked]:bg-info-soft [&_[data-slot=switch-thumb]]:!bg-white"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/scans")}
                    disabled={isSubmitting}
                  >
                    <XIcon className="mr-2 size-4" />
                    取消
                  </Button>
                  <Button
                    type="submit"
                    variant={enableSchedule ? "default" : "outline"}
                    disabled={isSubmitting || isLoadingData}
                    className={`rounded-full ${
                      enableSchedule
                        ? "border-info bg-info text-background"
                        : "border-warning/50 text-warning hover:bg-warning-soft"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderIcon className="mr-2 size-4 animate-spin" />
                        启动中……
                      </>
                    ) : enableSchedule ? (
                      <>
                        <CalendarClockIcon className="mr-2 size-4" />
                        创建计划扫描
                      </>
                    ) : (
                      <>
                        <PlayIcon className="mr-2 size-4" />
                        启动扫描
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {enableSchedule && (
                <div className="space-y-2">
                  <Label htmlFor="cron" className="flex items-center gap-2">
                    <ClockIcon className="size-4 text-muted-foreground" />
                    Cron 表达式
                  </Label>
                  <Input
                    id="cron"
                    type="text"
                    placeholder="0 0 * * *"
                    value={cronExpression}
                    onChange={(e) => {
                      setCronExpression(e.target.value);
                      if (cronError) validateCron(e.target.value);
                    }}
                  />
                  {cronError ? (
                    <p className="text-xs text-destructive">{cronError}</p>
                  ) : (
                    <div className="flex items-start gap-2 rounded-lg bg-muted p-3">
                      <InfoIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>格式：分钟 小时 日期 月份 星期</p>
                        <p>示例：</p>
                        <ul className="list-disc list-inside">
                          <li>
                            <code className="bg-background px-1 rounded">0 0 * * *</code> - 每天午夜
                          </li>
                          <li>
                            <code className="bg-background px-1 rounded">0 */6 * * *</code> - 每 6 小时
                          </li>
                          <li>
                            <code className="bg-background px-1 rounded">0 0 * * 0</code> - 每周日
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
