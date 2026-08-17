"use client";

import * as React from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import yamlLang from "react-syntax-highlighter/dist/esm/languages/hljs/yaml";
import github from "react-syntax-highlighter/dist/esm/styles/hljs/github";
import atomOneDark from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";
import { useTheme } from "next-themes";
import {
  BotIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClipboardIcon,
  DatabaseIcon,
  KeyRoundIcon,
  LoaderIcon,
  PaletteIcon,
  PencilIcon,
  PlugIcon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  SearchIcon,
  ServerIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionCardHeader } from "@/components/shared/section-card-header";
import { fetchAgentHarnessStatus } from "@/lib/api/agent-pentest";
import { isDemoMode, setDemoMode } from "@/lib/api/demo-mode";
import { API_PREFIX } from "@/lib/api/prefix";
import {
  createSettingsSkill,
  deleteSettingsSkill,
  getProductSettings,
  getSettingsSkill,
  getSettingsSkills,
  getSettingsYaml,
  reloadSettings,
  updateSettingsSkill,
  updateAISettings,
  type ProductSettings,
  type SettingsSkill,
  type SettingsSkills,
} from "@/lib/api/settings";
import type { AgentHarnessStatus } from "@/lib/types/agent-pentest";
import { defaultThemeState } from "@/config/theme";
import { presets } from "@/theme-presets";

type AIProviderDraft = {
  provider: string;
  base_url: string;
  model: string;
  auth_token: string;
  auth_configured: boolean;
};

type AIParams = Omit<ProductSettings["llm"], "configured" | "providers">;

type SkillEditorState = {
  mode: "create" | "edit";
  slug: string;
  content: string;
};

const emptySkills: SettingsSkills = { coding: [], pentest: [], total: 0 };
const newSkillTemplate = `---
name: custom-skill
description: 说明这个 Skill 的用途和适用场景
---

# Custom Skill

## Instructions

在这里填写智能体需要遵循的操作说明。
`;

function skillErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.replace(/^\d+:/, "").trim() || fallback : fallback;
}

function ConfigState({ configured, yes = "已配置", no = "未配置" }: { configured: boolean; yes?: string; no?: string }) {
  return (
    <Badge variant={configured ? "success" : "outline"}>
      {configured ? <CheckCircle2Icon className="size-3" /> : <XCircleIcon className="size-3" />}
      {configured ? yes : no}
    </Badge>
  );
}

function OverviewCard({
  icon: Icon,
  title,
  status,
  children,
}: {
  icon: React.ElementType;
  title: string;
  status: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="flex size-8 items-center justify-center rounded-control bg-primary-soft text-primary-soft-fg">
              <Icon className="size-4" />
            </span>
            {title}
          </div>
          {status}
        </div>
        <div className="text-sm text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}

function SkillCollection({
  title,
  subtitle,
  skills,
  busySlug,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  skills: SettingsSkill[];
  busySlug?: string | null;
  onEdit?: (skill: SettingsSkill) => void;
  onDelete?: (skill: SettingsSkill) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <SectionCardHeader
        icon={WrenchIcon}
        title={title}
        description={subtitle}
        actions={<Badge variant="outline">{skills.length} 个</Badge>}
      />
      <CardContent>
        {skills.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">没有匹配的 Skill。</div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {skills.map((skill) => (
              <div key={`${skill.kind}-${skill.slug}`} className="rounded-control border border-border-subtle bg-muted/25 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{skill.name}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {skill.description || "暂无说明"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant={skill.status === "loaded" ? "success" : "info"}>
                      {skill.status === "loaded" ? "已加载" : "可安装"}
                    </Badge>
                    {skill.editable && onEdit ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`修改 ${skill.name}`}
                        title="修改 Skill"
                        disabled={busySlug !== null && busySlug !== undefined}
                        onClick={() => onEdit(skill)}
                      >
                        {busySlug === skill.slug ? <LoaderIcon className="size-4 animate-spin" /> : <PencilIcon className="size-4" />}
                      </Button>
                    ) : null}
                    {skill.editable && onDelete ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        aria-label={`删除 ${skill.name}`}
                        title="删除 Skill"
                        disabled={busySlug !== null && busySlug !== undefined}
                        onClick={() => onDelete(skill)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{skill.source}</span>
                  {skill.references ? <span>· {skill.references} 个参考文件</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { resolvedTheme: theme } = useTheme();
  const [activeTab, setActiveTab] = React.useState("overview");
  const [loading, setLoading] = React.useState(true);
  const [savingAI, setSavingAI] = React.useState(false);
  const [product, setProduct] = React.useState<ProductSettings | null>(null);
  const [skills, setSkills] = React.useState<SettingsSkills>(emptySkills);
  const [harness, setHarness] = React.useState<AgentHarnessStatus | null>(null);
  const [providers, setProviders] = React.useState<AIProviderDraft[]>([]);
  const [aiParams, setAIParams] = React.useState<AIParams | null>(null);
  const [skillSearch, setSkillSearch] = React.useState("");
  const [skillEditor, setSkillEditor] = React.useState<SkillEditorState | null>(null);
  const [skillDeleteTarget, setSkillDeleteTarget] = React.useState<SettingsSkill | null>(null);
  const [skillBusySlug, setSkillBusySlug] = React.useState<string | null>(null);

  const [endpoint, setEndpoint] = React.useState("");
  const [token, setToken] = React.useState("");
  const [prefixKey, setPrefixKey] = React.useState("");
  const [demoModeEnabled, setDemoModeEnabled] = React.useState(false);
  const [preset, setPreset] = React.useState("default");
  const [sidebarCollapsedByDefault, setSidebarCollapsedByDefault] = React.useState(false);
  const [settingsYaml, setSettingsYaml] = React.useState("");
  const [loadingYaml, setLoadingYaml] = React.useState(false);
  const [advancedAI, setAdvancedAI] = React.useState(false);
  const [yamlOpen, setYamlOpen] = React.useState(false);

  const currentPreset = preset === "default" ? null : presets[preset];

  const applyProduct = React.useCallback((next: ProductSettings) => {
    setProduct(next);
    setProviders(
      next.llm.providers.length
        ? next.llm.providers.map((provider) => ({ ...provider, auth_token: "" }))
        : [{ provider: "openai", base_url: "https://api.openai.com/v1", model: "", auth_token: "", auth_configured: false }]
    );
    const { configured: _configured, providers: _providers, ...params } = next.llm;
    void _configured;
    void _providers;
    setAIParams(params);
  }, []);

  const loadPageData = React.useCallback(async () => {
    setLoading(true);
    const demoMode = isDemoMode();
    const [productResult, skillsResult, harnessResult] = await Promise.allSettled([
      getProductSettings(),
      getSettingsSkills(),
      demoMode ? Promise.resolve(null) : fetchAgentHarnessStatus(),
    ]);
    if (productResult.status === "fulfilled") applyProduct(productResult.value);
    else toast.error("无法读取平台设置");
    if (skillsResult.status === "fulfilled") setSkills(skillsResult.value);
    if (harnessResult.status === "fulfilled" && harnessResult.value) setHarness(harnessResult.value);
    setLoading(false);
  }, [applyProduct]);

  React.useEffect(() => {
    SyntaxHighlighter.registerLanguage("yaml", yamlLang);
    const savedEndpoint = localStorage.getItem("osmedeus_api_endpoint") || "";
    const savedToken = localStorage.getItem("osmedeus_token") || "";
    const savedPrefixKey = localStorage.getItem("osmedeus_workspace_prefix_key") || "";
    const savedPreset = localStorage.getItem("osmedeus_theme_preset");
    setEndpoint(savedEndpoint);
    setToken(savedToken);
    setPrefixKey(savedPrefixKey);
    if (savedPreset) setPreset(savedPreset);
    setSidebarCollapsedByDefault(localStorage.getItem("osmedeus_sidebar_collapsed_by_default") === "true");
    setDemoModeEnabled(isDemoMode());
    void loadPageData();
  }, [loadPageData]);

  const loadYaml = React.useCallback(async () => {
    setLoadingYaml(true);
    try {
      setSettingsYaml(await getSettingsYaml());
    } catch {
      toast.error("加载配置失败");
    } finally {
      setLoadingYaml(false);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab === "advanced" && !settingsYaml) void loadYaml();
  }, [activeTab, loadYaml, settingsYaml]);

  const setProviderField = (index: number, field: keyof AIProviderDraft, value: string) => {
    setProviders((current) => current.map((provider, i) => (i === index ? { ...provider, [field]: value } : provider)));
  };

  const addProvider = () => {
    setProviders((current) => [
      ...current,
      { provider: "openai", base_url: "https://api.openai.com/v1", model: "", auth_token: "", auth_configured: false },
    ]);
  };

  const saveAI = async () => {
    if (!aiParams) return;
    setSavingAI(true);
    try {
      await updateAISettings({
        ...aiParams,
        providers: providers.map((provider) => ({
          provider: provider.provider,
          base_url: provider.base_url,
          model: provider.model,
          auth_token: provider.auth_token,
          keep_auth_token: provider.auth_configured && !provider.auth_token.trim(),
        })),
      });
      applyProduct(await getProductSettings());
      toast.success("AI 与模型配置已保存");
    } catch {
      toast.error("保存失败，请检查服务商、模型与参数");
    } finally {
      setSavingAI(false);
    }
  };

  const saveApiConfig = () => {
    const trimmed = endpoint.trim().replace(/\/+$/, "");
    const normalized =
      trimmed === API_PREFIX
        ? window.location.origin
        : trimmed.endsWith(API_PREFIX)
          ? trimmed.slice(0, -API_PREFIX.length).replace(/\/+$/, "")
          : trimmed;
    localStorage.setItem("osmedeus_api_endpoint", normalized.startsWith("/") ? window.location.origin : normalized);
    localStorage.setItem("osmedeus_token", token);
    localStorage.setItem("osmedeus_workspace_prefix_key", prefixKey.trim());
    toast.success("控制台连接已保存");
  };

  const savePreset = (value: string) => {
    setPreset(value);
    localStorage.setItem("osmedeus_theme_preset", value);
    localStorage.removeItem("osmedeus_theme_light_primary");
    localStorage.removeItem("osmedeus_theme_light_secondary");
    localStorage.removeItem("osmedeus_theme_dark_primary");
    localStorage.removeItem("osmedeus_theme_dark_secondary");
    window.dispatchEvent(new Event("osmedeus-theme-colors-updated"));
    toast.success("主题已应用");
  };

  const saveSidebarCollapsed = (checked: boolean) => {
    setSidebarCollapsedByDefault(checked);
    localStorage.setItem("osmedeus_sidebar_collapsed_by_default", checked ? "true" : "false");
    window.dispatchEvent(new CustomEvent("osmedeus-sidebar-collapsed-by-default-changed", { detail: checked }));
    toast.success("外观设置已更新");
  };

  const openCreateSkill = () => {
    setSkillEditor({ mode: "create", slug: "custom-skill", content: newSkillTemplate });
  };

  const openEditSkill = async (skill: SettingsSkill) => {
    setSkillBusySlug(skill.slug);
    try {
      const detail = await getSettingsSkill(skill.slug);
      setSkillEditor({ mode: "edit", slug: detail.slug, content: detail.content });
    } catch (error) {
      toast.error("无法读取 Skill", { description: skillErrorMessage(error, "请稍后重试") });
    } finally {
      setSkillBusySlug(null);
    }
  };

  const changeNewSkillSlug = (slug: string) => {
    setSkillEditor((current) =>
      current?.mode === "create"
        ? { ...current, slug, content: current.content.replace(/^name\s*:.*$/m, `name: ${slug}`) }
        : current
    );
  };

  const saveSkill = async () => {
    if (!skillEditor) return;
    const slug = skillEditor.slug.trim();
    if (!slug || !skillEditor.content.trim()) {
      toast.error("请填写 Skill 标识和 SKILL.md 内容");
      return;
    }
    setSkillBusySlug(slug);
    try {
      if (skillEditor.mode === "create") {
        await createSettingsSkill({ slug, content: skillEditor.content });
      } else {
        await updateSettingsSkill(slug, { content: skillEditor.content });
      }
      setSkillEditor(null);
      toast.success(skillEditor.mode === "create" ? "Skill 已添加" : "Skill 已保存");
      try {
        setSkills(await getSettingsSkills());
      } catch (error) {
        toast.warning("Skill 已保存，但列表刷新失败", { description: skillErrorMessage(error, "请刷新页面") });
      }
    } catch (error) {
      toast.error(skillEditor.mode === "create" ? "添加 Skill 失败" : "保存 Skill 失败", {
        description: skillErrorMessage(error, "请检查标识和 frontmatter"),
      });
    } finally {
      setSkillBusySlug(null);
    }
  };

  const deleteSkill = async () => {
    if (!skillDeleteTarget) return;
    const target = skillDeleteTarget;
    setSkillBusySlug(target.slug);
    try {
      await deleteSettingsSkill(target.slug);
      setSkillDeleteTarget(null);
      toast.success(`Skill ${target.name} 已删除`);
      try {
        setSkills(await getSettingsSkills());
      } catch (error) {
        toast.warning("Skill 已删除，但列表刷新失败", { description: skillErrorMessage(error, "请刷新页面") });
      }
    } catch (error) {
      toast.error("删除 Skill 失败", { description: skillErrorMessage(error, "请稍后重试") });
    } finally {
      setSkillBusySlug(null);
    }
  };

  const filteredSkills = React.useMemo(() => {
    const query = skillSearch.trim().toLowerCase();
    const filter = (items: SettingsSkill[]) =>
      query ? items.filter((skill) => `${skill.name} ${skill.description} ${skill.source}`.toLowerCase().includes(query)) : items;
    return { coding: filter(skills.coding), pentest: filter(skills.pentest) };
  }, [skillSearch, skills]);

  if (loading && !product) {
    return (
      <div className="flex min-h-[24rem] items-center justify-center text-sm text-muted-foreground">
        <LoaderIcon className="mr-2 size-5 animate-spin" />正在读取设置……
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {demoModeEnabled ? (
        <div className="flex flex-col gap-3 rounded-control border border-warning/30 bg-warning-soft p-4 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">当前正在使用演示模式</div>
            <div className="mt-1 opacity-90">页面显示的是示例数据，不会连接真实扫描后端。</div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setDemoMode(false);
              setDemoModeEnabled(false);
              window.location.reload();
            }}
          >
            退出演示模式
          </Button>
        </div>
      ) : null}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
      <div className="overflow-x-auto pb-1">
        <TabsList className="h-auto min-w-max justify-start">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="ai">AI 与模型</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="system">系统与连接</TabsTrigger>
          <TabsTrigger value="appearance">外观</TabsTrigger>
          <TabsTrigger value="advanced">高级</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OverviewCard icon={BrainCircuitIcon} title="平台 AI" status={<ConfigState configured={product?.llm.configured === true} />}>
            <div className="truncate font-medium text-foreground">{product?.llm.providers[0]?.model || "尚未选择模型"}</div>
            <div className="mt-1">{product?.llm.providers.length || 0} 个服务商，支持故障切换</div>
          </OverviewCard>
          <OverviewCard icon={ShieldCheckIcon} title="智能渗透" status={<ConfigState configured={harness?.connected === true} yes="在线" no="离线" />}>
            <div className="truncate font-medium text-foreground">{harness?.provider || product?.agent_harness.provider || "未配置"}</div>
            <div className="mt-1">隔离的智能体运行时与渗透 Skills</div>
          </OverviewCard>
          <OverviewCard icon={WrenchIcon} title="Skills" status={<Badge variant="info">{skills.total} 个</Badge>}>
            <div className="font-medium text-foreground">{skills.pentest.length} 个智能渗透 · {skills.coding.length} 个编码助手</div>
            <div className="mt-1">已按使用场景分组，不再混进系统参数</div>
          </OverviewCard>
          <OverviewCard icon={ServerIcon} title="系统" status={<Badge variant="outline">{product?.version || "-"}</Badge>}>
            <div className="font-medium text-foreground">{product?.system.database_engine || "sqlite"}</div>
            <div className="mt-1">热重载{product?.system.hot_reload_enabled ? "已启用" : "未启用"}</div>
          </OverviewCard>
        </div>

        <Card className="overflow-hidden">
          <SectionCardHeader icon={PlugIcon} title="能力状态" description="常用能力只显示是否可用，具体参数放到对应分类中" />
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center justify-between rounded-control border p-3 text-sm"><span>Redis 分布式</span><ConfigState configured={product?.system.redis_configured === true} /></div>
            <div className="flex items-center justify-between rounded-control border p-3 text-sm"><span>对象存储</span><ConfigState configured={product?.system.storage_configured === true} /></div>
            <div className="flex items-center justify-between rounded-control border p-3 text-sm"><span>通知</span><ConfigState configured={product?.system.notification_enabled === true} yes="已启用" no="未启用" /></div>
            <div className="flex items-center justify-between rounded-control border p-3 text-sm"><span>云端节点</span><ConfigState configured={product?.system.cloud_enabled === true} yes="已启用" no="未启用" /></div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <SectionCardHeader icon={KeyRoundIcon} title="外部情报源" description="这里只显示密钥状态，不会把密钥返回到浏览器" />
          <CardContent className="flex flex-wrap gap-3">
            {product?.integrations.map((integration) => (
              <div key={integration.id} className="flex min-w-40 items-center justify-between gap-4 rounded-control border px-3 py-2 text-sm">
                <span>{integration.label}</span><ConfigState configured={integration.configured} />
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ai" className="space-y-4">
        <Card className="overflow-hidden">
          <SectionCardHeader
            icon={BrainCircuitIcon}
            title="平台 AI 与模型"
            description="工作流中的 LLM/Agent 步骤使用这些服务商；按顺序自动故障切换"
            actions={
              <Button onClick={saveAI} disabled={savingAI || !aiParams}>
                {savingAI ? <LoaderIcon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
                保存 AI 配置
              </Button>
            }
          />
          <CardContent className="space-y-4">
            <div className="rounded-control border border-info/25 bg-info-soft p-3 text-sm text-info">
              API Key 为只写字段：已配置的密钥不会显示；输入新值才会替换，留空则保留原密钥。
            </div>
            {providers.map((provider, index) => {
              const knownProviders = ["deepseek", "openai", "anthropic", "ollama", "custom"];
              const providerOptions = knownProviders.includes(provider.provider) ? knownProviders : [provider.provider, ...knownProviders];
              return (
                <div key={index} className="space-y-4 rounded-control border bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium"><BotIcon className="size-4 text-muted-foreground" />服务商 {index + 1}</div>
                    <Button variant="ghost" size="icon-sm" aria-label={`删除服务商 ${index + 1}`} disabled={providers.length === 1} onClick={() => setProviders((current) => current.filter((_, i) => i !== index))}>
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">服务商</label>
                      <Select value={provider.provider} onValueChange={(value) => setProviderField(index, "provider", value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{providerOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 xl:col-span-1">
                      <label className="text-sm font-medium">模型</label>
                      <Input value={provider.model} onChange={(event) => setProviderField(index, "model", event.target.value)} placeholder="例如 deepseek-chat" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">API Key</label>
                      <Input type="password" value={provider.auth_token} onChange={(event) => setProviderField(index, "auth_token", event.target.value)} placeholder={provider.auth_configured ? "已配置，留空保留" : provider.provider === "ollama" ? "本地模型可留空" : "输入 API Key"} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">API 地址</label>
                      <Input value={provider.base_url} onChange={(event) => setProviderField(index, "base_url", event.target.value)} placeholder="OpenAI 兼容接口地址" />
                    </div>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" onClick={addProvider}><PlusIcon className="size-4" />添加备用服务商</Button>

            {aiParams ? (
              <Collapsible open={advancedAI} onOpenChange={setAdvancedAI}>
                <div className="rounded-control border">
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
                    <div><div className="font-medium">生成参数</div><div className="mt-1 text-sm text-muted-foreground">令牌、采样、超时与工具调用</div></div>
                    <ChevronDownIcon className={`size-4 transition-transform ${advancedAI ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t p-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2"><label className="text-sm font-medium">最大令牌数</label><Input type="number" min={1} value={aiParams.max_tokens} onChange={(e) => setAIParams({ ...aiParams, max_tokens: Number(e.target.value) })} /></div>
                      <div className="space-y-2"><label className="text-sm font-medium">温度</label><Input type="number" min={0} max={2} step={0.1} value={aiParams.temperature} onChange={(e) => setAIParams({ ...aiParams, temperature: Number(e.target.value) })} /></div>
                      <div className="space-y-2"><label className="text-sm font-medium">Top P</label><Input type="number" min={0} max={1} step={0.05} value={aiParams.top_p} onChange={(e) => setAIParams({ ...aiParams, top_p: Number(e.target.value) })} /></div>
                      <div className="space-y-2"><label className="text-sm font-medium">Top K</label><Input type="number" min={0} value={aiParams.top_k} onChange={(e) => setAIParams({ ...aiParams, top_k: Number(e.target.value) })} /></div>
                      <div className="space-y-2"><label className="text-sm font-medium">失败重试</label><Input type="number" min={0} value={aiParams.max_retries} onChange={(e) => setAIParams({ ...aiParams, max_retries: Number(e.target.value) })} /></div>
                      <div className="space-y-2"><label className="text-sm font-medium">请求超时</label><Input value={aiParams.timeout} onChange={(e) => setAIParams({ ...aiParams, timeout: e.target.value })} placeholder="2m" /></div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <div className="flex items-center justify-between rounded-control border p-3 text-sm"><span>允许工具调用</span><Switch checked={aiParams.enabled_tool_call} onCheckedChange={(checked) => setAIParams({ ...aiParams, enabled_tool_call: checked })} /></div>
                      <div className="flex items-center justify-between rounded-control border p-3 text-sm"><span>流式输出</span><Switch checked={aiParams.stream} onCheckedChange={(checked) => setAIParams({ ...aiParams, stream: checked })} /></div>
                      <div className="flex items-center justify-between rounded-control border p-3 text-sm"><span>结构化 JSON</span><Switch checked={aiParams.structured_json_format} onCheckedChange={(checked) => setAIParams({ ...aiParams, structured_json_format: checked })} /></div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ) : null}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <SectionCardHeader icon={ShieldCheckIcon} title="智能渗透 AI" description="独立的 DSH 智能体运行时，不与平台工作流模型混用" actions={<ConfigState configured={harness?.connected === true} yes="运行中" no="未连接" />} />
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-control border p-3"><div className="text-xs text-muted-foreground">提供方</div><div className="mt-1 font-medium">{harness?.provider || product?.agent_harness.provider || "-"}</div></div>
            <div className="rounded-control border p-3 md:col-span-2"><div className="text-xs text-muted-foreground">运行时地址</div><div className="mt-1 truncate font-mono text-sm">{harness?.base_url || product?.agent_harness.base_url || "-"}</div></div>
            <p className="text-sm text-muted-foreground md:col-span-3">这里先明确展示运行状态与边界；DSH 自身的模型凭据仍由隔离运行时管理，避免把两套 AI 配置混在一起。</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="skills" className="space-y-4">
        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="font-medium">Skills 管理</div><p className="mt-1 text-sm text-muted-foreground">添加、修改或删除智能渗透运行时的能力包。</p></div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative w-full sm:w-80"><SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} placeholder="搜索名称、说明或来源" /></div>
              <Button disabled={skillBusySlug !== null} onClick={openCreateSkill}><PlusIcon className="size-4" />添加 Skill</Button>
            </div>
          </CardContent>
        </Card>
        <SkillCollection
          title="智能渗透 Skills"
          subtitle="已加载到 DSH 运行时，可在这里直接添加、修改和删除"
          skills={filteredSkills.pentest}
          busySlug={skillBusySlug}
          onEdit={openEditSkill}
          onDelete={setSkillDeleteTarget}
        />
        <SkillCollection title="编码助手 Skills" subtitle="随平台编译发布，因此在这里保持只读" skills={filteredSkills.coding} />
        <div className="rounded-control border border-warning/25 bg-warning-soft p-3 text-sm text-warning">
          运行时自带的智能渗透 Skills 可能会在 Agent Harness 重启后按发行版本恢复；长期定制建议使用新的 Skill 标识。
        </div>
        <div className="rounded-control border bg-muted/25 p-3 text-sm text-muted-foreground">
          安装全部编码助手 Skills：<code className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">osmedeus skills install --agent codex --all</code>
        </div>
      </TabsContent>

      <TabsContent value="system" className="space-y-4">
        <Card className="overflow-hidden">
          <SectionCardHeader icon={PlugIcon} title="控制台连接" description="仅保存在当前浏览器，用于连接 Osmedeus API 与打开原始产物" />
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2"><label className="text-sm font-medium">API 地址</label><Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="http://localhost:8002" /></div>
              <div className="space-y-2"><label className="text-sm font-medium">API 令牌</label><Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer 令牌" /></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">工作区访问密钥</label><Input type="password" value={prefixKey} onChange={(e) => setPrefixKey(e.target.value)} placeholder="workspace_prefix_key" /><p className="text-xs text-muted-foreground">用于在新标签页打开 <code>/ws/&lt;key&gt;/…</code> 下的原始产物。</p></div>
            <Button onClick={saveApiConfig}><SaveIcon className="size-4" />保存控制台连接</Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <SectionCardHeader icon={DatabaseIcon} title="运行环境" description="高频状态一眼看清；低频原始参数留在高级设置" />
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-control border p-3"><div className="text-xs text-muted-foreground">数据库</div><div className="mt-1 font-medium">{product?.system.database_engine || "sqlite"}</div></div>
            <div className="rounded-control border p-3"><div className="text-xs text-muted-foreground">基础目录</div><div className="mt-1 truncate font-mono text-sm" title={product?.system.base_folder}>{product?.system.base_folder || "-"}</div></div>
            <div className="rounded-control border p-3"><div className="text-xs text-muted-foreground">默认并发</div><div className="mt-1 font-medium">{product?.scan_tactic.default ?? "-"}</div></div>
            <div className="rounded-control border p-3"><div className="text-xs text-muted-foreground">温和 / 激进并发</div><div className="mt-1 font-medium">{product?.scan_tactic.gently ?? "-"} / {product?.scan_tactic.aggressive ?? "-"}</div></div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <SectionCardHeader icon={KeyRoundIcon} title="集成状态" description="凭据仍由服务器保管，页面只读取是否已经配置" />
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {product?.integrations.map((integration) => <div key={integration.id} className="flex items-center justify-between rounded-control border p-3 text-sm"><span>{integration.label}</span><ConfigState configured={integration.configured} /></div>)}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="appearance" className="space-y-4">
        <Card className="overflow-hidden">
          <SectionCardHeader
            icon={PaletteIcon}
            title="外观"
            description="主题和侧边栏偏好只影响当前浏览器"
            actions={
              <Select value={preset} onValueChange={savePreset}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">默认</SelectItem>
                  {Object.keys(presets).map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            }
          />
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4"><div><div className="text-sm font-medium">默认折叠侧边栏</div><p className="mt-1 text-sm text-muted-foreground">打开控制台时获得更大的内容区域</p></div><Switch checked={sidebarCollapsedByDefault} onCheckedChange={saveSidebarCollapsed} /></div>
            <div>
              <div className="mb-2 text-sm font-medium">当前主题色</div>
              <div className="flex gap-2">
                {[currentPreset?.light?.primary || defaultThemeState.light?.primary, currentPreset?.light?.secondary || defaultThemeState.light?.secondary, currentPreset?.dark?.primary || defaultThemeState.dark?.primary, currentPreset?.dark?.secondary || defaultThemeState.dark?.secondary].map((color, index) => <span key={index} className="size-9 rounded-control border" style={{ backgroundColor: color }} />)}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="advanced" className="space-y-4">
        <Card className="overflow-hidden">
          <SectionCardHeader icon={SlidersHorizontalIcon} title="开发与演示" description="日常使用不需要调整这些选项" />
          <CardContent>
            <div className="flex items-center justify-between gap-4"><div><div className="text-sm font-medium">演示模式</div><p className="mt-1 text-sm text-muted-foreground">使用示例数据且不连接真实 API，切换后会刷新页面</p></div><Switch checked={demoModeEnabled} onCheckedChange={(checked) => { setDemoModeEnabled(checked); setDemoMode(checked); setTimeout(() => window.location.reload(), 400); }} /></div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <SectionCardHeader
            icon={Settings2Icon}
            title="服务器原始配置"
            description="只读、已脱敏；常用配置请优先在上面的分类页修改"
            actions={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={async () => { await reloadSettings(); await loadPageData(); toast.success("服务器配置已重新加载"); }}><RefreshCwIcon className="size-4" />重新加载</Button>
                <Button variant="outline" size="sm" disabled={!settingsYaml} onClick={async () => { await navigator.clipboard.writeText(settingsYaml); toast.success("已复制脱敏配置"); }}><ClipboardIcon className="size-4" />复制</Button>
              </div>
            }
          />
          <CardContent>
            <Collapsible open={yamlOpen} onOpenChange={setYamlOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-control border bg-muted/25 p-4 text-left">
                <div><div className="font-medium">查看 osm-settings.yaml</div><div className="mt-1 text-sm text-muted-foreground">敏感值会在服务端递归替换为 [REDACTED]</div></div>
                <ChevronDownIcon className={`size-4 transition-transform ${yamlOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                {loadingYaml ? (
                  <div className="py-10 text-center text-sm text-muted-foreground"><LoaderIcon className="mx-auto mb-2 size-5 animate-spin" />正在加载……</div>
                ) : (
                  <div className="max-h-[36rem] overflow-auto rounded-control border bg-muted/20 p-4">
                    <SyntaxHighlighter language="yaml" style={theme === "dark" ? atomOneDark : github} customStyle={{ margin: 0, padding: 0, background: "transparent", fontSize: "0.8rem" }} showLineNumbers>{settingsYaml}</SyntaxHighlighter>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>

      <Dialog
        open={skillEditor !== null}
        onOpenChange={(open) => {
          if (!open && !skillBusySlug) setSkillEditor(null);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{skillEditor?.mode === "create" ? "添加智能渗透 Skill" : "修改智能渗透 Skill"}</DialogTitle>
            <DialogDescription>
              编辑完整的 SKILL.md。frontmatter 中必须包含 name 和 description，且 name 要与 Skill 标识一致。
            </DialogDescription>
          </DialogHeader>
          {skillEditor ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="skill-slug" className="text-sm font-medium">Skill 标识</label>
                <Input
                  id="skill-slug"
                  value={skillEditor.slug}
                  disabled={skillEditor.mode === "edit" || skillBusySlug !== null}
                  onChange={(event) => changeNewSkillSlug(event.target.value)}
                  placeholder="custom-skill"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">仅支持小写字母、数字和连字符；保存后不可重命名。</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="skill-content" className="text-sm font-medium">SKILL.md</label>
                <textarea
                  id="skill-content"
                  className="min-h-[26rem] w-full resize-y rounded-control border border-input bg-background p-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
                  value={skillEditor.content}
                  disabled={skillBusySlug !== null}
                  onChange={(event) => setSkillEditor({ ...skillEditor, content: event.target.value })}
                  spellCheck={false}
                />
              </div>
              <div className="rounded-control border border-warning/25 bg-warning-soft p-3 text-sm text-warning">
                如果修改的是随 Agent Harness 发布的内置 Skill，运行时重启后可能恢复发行版内容。
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={skillBusySlug !== null} onClick={() => setSkillEditor(null)}>取消</Button>
            <Button
              disabled={!skillEditor?.slug.trim() || !skillEditor?.content.trim() || skillBusySlug !== null}
              onClick={saveSkill}
            >
              {skillBusySlug ? <LoaderIcon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
              {skillEditor?.mode === "create" ? "添加 Skill" : "保存修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={skillDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !skillBusySlug) setSkillDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除 Skill？</DialogTitle>
            <DialogDescription>
              将永久删除 <span className="font-medium text-foreground">{skillDeleteTarget?.name}</span> 的整个运行时目录，包括 references 等附带文件。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-control border border-warning/25 bg-warning-soft p-3 text-sm text-warning">
            此操作无法撤销；随 Agent Harness 发布的内置 Skill 可能会在运行时重启后重新出现。
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={skillBusySlug !== null} onClick={() => setSkillDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" disabled={skillBusySlug !== null} onClick={deleteSkill}>
              {skillBusySlug ? <LoaderIcon className="size-4 animate-spin" /> : <Trash2Icon className="size-4" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
