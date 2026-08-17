"use client";

import * as React from "react";
import {
  authorizeCompanyCandidates,
  confirmCompany,
  discoverCompany,
  intakeCompany,
  startCompanyRecon,
} from "@/lib/api/companies";
import type { CompanyBundle, CompanyProviderReport } from "@/lib/types/company";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2Icon, CheckCircle2Icon, DatabaseZapIcon, LoaderIcon, PlayIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

interface CompanyIntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => Promise<void> | void;
  initialBundle?: CompanyBundle | null;
}

export function CompanyIntakeDialog({ open, onOpenChange, onCompleted, initialBundle }: CompanyIntakeDialogProps) {
  const [bundle, setBundle] = React.useState<CompanyBundle | null>(null);
  const [name, setName] = React.useState("");
  const [canonicalName, setCanonicalName] = React.useState("");
  const [officialWebsite, setOfficialWebsite] = React.useState("");
  const [registrationNumber, setRegistrationNumber] = React.useState("");
  const [creditCode, setCreditCode] = React.useState("");
  const [domainsText, setDomainsText] = React.useState("");
  const [selectedDomains, setSelectedDomains] = React.useState<string[]>([]);
  const [reports, setReports] = React.useState<CompanyProviderReport[]>([]);
  const [selectedCandidates, setSelectedCandidates] = React.useState<number[]>([]);
  const [scanProfile, setScanProfile] = React.useState<"lite" | "standard" | "extensive">("standard");
  const [busy, setBusy] = React.useState<"intake" | "discover" | "confirm" | "import" | "scan" | null>(null);

  const reset = React.useCallback(() => {
    setBundle(null);
    setName("");
    setCanonicalName("");
    setOfficialWebsite("");
    setRegistrationNumber("");
    setCreditCode("");
    setDomainsText("");
    setSelectedDomains([]);
    setReports([]);
    setSelectedCandidates([]);
    setScanProfile("standard");
    setBusy(null);
  }, []);

  React.useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    if (initialBundle) {
      setBundle(initialBundle);
      setName(initialBundle.profile.input_name);
      setCanonicalName(initialBundle.profile.canonical_name);
      setOfficialWebsite(initialBundle.profile.official_website || "");
      setRegistrationNumber(initialBundle.profile.registration_number || "");
      setCreditCode(initialBundle.profile.unified_credit_code || "");
      const isConfirmed = initialBundle.profile.verification_status === "confirmed";
      setSelectedDomains(initialBundle.domains
        .filter((domain) => isConfirmed ? domain.authorization_status === "approved" : domain.relation !== "provider-candidate")
        .map((domain) => domain.domain));
    }
  }, [initialBundle, open, reset]);

  const domains = React.useMemo(
    () => domainsText.split(/[\s,，;；]+/).map((value) => value.trim()).filter(Boolean),
    [domainsText]
  );

  const handleIntake = async () => {
    if (!name.trim()) return;
    setBusy("intake");
    try {
      const result = await intakeCompany({
        name: name.trim(),
        canonical_name: canonicalName.trim() || undefined,
        official_website: officialWebsite.trim() || undefined,
        registration_number: registrationNumber.trim() || undefined,
        unified_credit_code: creditCode.trim() || undefined,
        domains,
      });
      setBundle(result.data);
      setCanonicalName(result.data.profile.canonical_name);
      setSelectedDomains(result.data.domains.map((domain) => domain.domain));
      toast.success("公司草稿已建立", { description: "尚未创建组织、工作区或扫描任务。" });
    } catch (error) {
      toast.error(cleanError(error, "公司录入失败"));
    } finally {
      setBusy(null);
    }
  };

  const handleDiscover = async () => {
    if (!bundle) return;
    setBusy("discover");
    try {
      const result = await discoverCompany(bundle.profile.uuid);
      setBundle(result.data);
      setReports(result.providers);
      toast.success(`被动查询完成，保存 ${result.stored} 条候选`);
    } catch (error) {
      toast.error(cleanError(error, "被动查询失败"));
    } finally {
      setBusy(null);
    }
  };

  const handleConfirm = async () => {
    if (!bundle || selectedDomains.length === 0 || !canonicalName.trim()) return;
    setBusy("confirm");
    try {
      const result = await confirmCompany(bundle.profile.uuid, { canonical_name: canonicalName.trim(), domains: selectedDomains });
      setBundle(result.data);
      toast.success("公司已确认", { description: `已创建组织和 ${result.created.workspaces.length} 个授权工作区；未自动启动扫描。` });
      await onCompleted();
    } catch (error) {
      toast.error(cleanError(error, "确认公司失败"));
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    if (!bundle || selectedCandidates.length === 0) return;
    setBusy("import");
    try {
      const result = await authorizeCompanyCandidates(bundle.profile.uuid, selectedCandidates);
      setBundle(result.data);
      setSelectedCandidates([]);
      toast.success(`已授权并导入 ${result.imported} 条资产`, { description: "资产已归入对应工作区，仍未自动启动扫描。" });
      await onCompleted();
    } catch (error) {
      toast.error(cleanError(error, "候选资产导入失败"));
    } finally {
      setBusy(null);
    }
  };

  const handleScan = async () => {
    if (!bundle || bundle.profile.verification_status !== "confirmed") return;
    setBusy("scan");
    try {
      const result = await startCompanyRecon(bundle.profile.uuid, scanProfile);
      toast.success(`已启动 ${result.target_count} 个授权根域扫描`, { description: `任务组 ${result.job_id} · ${scanProfile}` });
      onOpenChange(false);
    } catch (error) {
      toast.error(cleanError(error, "启动公司收集失败"));
    } finally {
      setBusy(null);
    }
  };

  const confirmed = bundle?.profile.verification_status === "confirmed";
  const pendingCandidates = (bundle?.candidates || []).filter((candidate) => candidate.authorization_status !== "approved");
  const newlySelectedRoots = (bundle?.domains || []).filter((domain) =>
    domain.authorization_status !== "approved" && selectedDomains.includes(domain.domain)
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2Icon className="size-5 text-primary" />按公司录入资产范围</DialogTitle>
          <DialogDescription>先确认法律主体，再授权根域名。公司不会直接变成工作区，外部平台结果也不会自动进入扫描。</DialogDescription>
        </DialogHeader>

        {!bundle ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="输入名称" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：字节跳动" autoFocus /></Field>
              <Field label="工商完整名称"><Input value={canonicalName} onChange={(e) => setCanonicalName(e.target.value)} placeholder="例如：北京字节跳动科技有限公司" /></Field>
              <Field label="官方网站"><Input value={officialWebsite} onChange={(e) => setOfficialWebsite(e.target.value)} placeholder="https://example.com" /></Field>
              <Field label="其他根域名"><Input value={domainsText} onChange={(e) => setDomainsText(e.target.value)} placeholder="example.cn, example.net" /></Field>
              <Field label="工商注册号"><Input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="可选，作为核验依据" /></Field>
              <Field label="统一社会信用代码"><Input value={creditCode} onChange={(e) => setCreditCode(e.target.value)} placeholder="可选，建议填写" /></Field>
            </div>
            <div className="rounded-control border border-info/25 bg-info-soft p-3 text-sm text-info">仅凭简称无法可靠判断公司全称。系统保存你提供的证据并要求下一步人工确认，不会让模型猜一个名称后直接扫描。</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-control border p-4 sm:grid-cols-2">
              <Field label="确认后的公司全称"><Input value={canonicalName} onChange={(e) => setCanonicalName(e.target.value)} disabled={confirmed} /></Field>
              <div className="flex items-end justify-between gap-3 rounded-control bg-muted/30 px-3 py-2">
                <div><div className="text-xs text-muted-foreground">身份置信度</div><div className="mt-1 font-medium">{bundle.profile.confidence}%</div></div>
                <Badge variant={confirmed ? "success" : "secondary"}>{confirmed ? "已确认" : "待人工确认"}</Badge>
              </div>
            </div>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div><h3 className="text-sm font-medium">授权根域名</h3><p className="mt-1 text-xs text-muted-foreground">测绘发现的新根域必须人工勾选，才能成为工作区和扫描范围。</p></div>
                {confirmed && newlySelectedRoots.length > 0 ? <Button size="sm" onClick={() => void handleConfirm()} disabled={busy !== null}>{busy === "confirm" ? <LoaderIcon className="size-4 animate-spin" /> : <ShieldCheckIcon className="size-4" />}批准 {newlySelectedRoots.length} 个新根域</Button> : <Badge variant="outline">{selectedDomains.length} 个</Badge>}
              </div>
              {bundle.domains.length ? bundle.domains.map((domain) => (
                <label key={domain.domain} className="flex items-center justify-between gap-3 rounded-control border p-3">
                  <span className="flex items-center gap-3">
                    <Checkbox checked={selectedDomains.includes(domain.domain)} disabled={domain.authorization_status === "approved"} onCheckedChange={(checked) => setSelectedDomains((current) => checked ? [...new Set([...current, domain.domain])] : current.filter((item) => item !== domain.domain))} />
                    <span><span className="block font-mono text-sm">{domain.domain}</span><span className="block text-xs text-muted-foreground">{domain.relation} · 证据置信度 {domain.confidence}%{domain.sources?.length ? ` · ${domain.sources.join(" / ")}` : ""}</span>{domain.evidence ? <span className="mt-1 block text-xs text-muted-foreground">{domain.evidence}</span> : null}</span>
                  </span>
                  <Badge variant={domain.authorization_status === "approved" ? "success" : "outline"}>{domain.authorization_status === "approved" ? "已授权" : "待确认"}</Badge>
                </label>
              )) : <div className="rounded-control border border-warning/30 bg-warning-soft p-3 text-sm text-warning">没有可确认的根域名。返回后填写官网或域名。</div>}
            </section>

            <section className="space-y-3 rounded-control border p-4">
                <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-medium">外部被动情报</h3><p className="mt-1 text-xs text-muted-foreground">只查询并保存候选，不探测目标。</p></div><Button variant="outline" size="sm" onClick={() => void handleDiscover()} disabled={busy !== null}>{busy === "discover" ? <LoaderIcon className="size-4 animate-spin" /> : <DatabaseZapIcon className="size-4" />}查询 FOFA / Quake / Hunter / 0.zone</Button></div>
                {reports.length ? <div className="grid gap-2 sm:grid-cols-2">{reports.map((report) => <div key={report.id} className="min-w-0 rounded-control bg-muted/30 px-3 py-2 text-xs"><div className="flex items-center justify-between gap-2"><span>{report.id}</span><Badge variant={report.error ? "destructive" : report.configured ? "secondary" : "outline"}>{report.error ? "失败" : report.configured ? `${report.count} 条` : "未配置"}</Badge></div>{report.query ? <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={report.query}>{report.query}</div> : null}</div>)}</div> : null}
            </section>

            {pendingCandidates.length ? (
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-medium">候选资产归属分析</h3><p className="mt-1 text-xs text-muted-foreground">分数说明“可能属于谁”，勾选权限说明“当前是否允许导入”；两者相互独立。</p></div>{confirmed ? <Button size="sm" onClick={() => void handleImport()} disabled={busy !== null || selectedCandidates.length === 0}>{busy === "import" ? <LoaderIcon className="size-4 animate-spin" /> : <ShieldCheckIcon className="size-4" />}授权并导入</Button> : null}</div>
                <div className="max-h-80 space-y-2 overflow-y-auto">{pendingCandidates.map((candidate) => <label key={candidate.id} className="flex items-start gap-3 rounded-control border p-3">
                  <Checkbox className="mt-0.5" checked={selectedCandidates.includes(candidate.id)} disabled={!confirmed || !candidate.authorization_eligible} onCheckedChange={(checked) => setSelectedCandidates((current) => checked ? [...new Set([...current, candidate.id])] : current.filter((id) => id !== candidate.id))} />
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span className="flex flex-wrap items-center gap-1.5"><span className="max-w-full truncate font-mono text-xs">{candidate.asset_value}</span><Badge variant={attributionVariant(candidate.attribution_status)}>{candidate.confidence}% · {attributionLabel(candidate.attribution_status)}</Badge>{candidate.shared_infrastructure ? <Badge variant="warning">共享基础设施</Badge> : null}<Badge variant="outline">{infrastructureLabel(candidate.infrastructure_type)}</Badge></span>
                    <span className="block text-xs text-muted-foreground">{candidate.provider} · {candidate.domain || "裸 IP / 无域名归属"}{candidate.matched_root_domain ? ` · 匹配 ${candidate.matched_root_domain}` : ""}</span>
                    {candidate.attribution_reasons?.length ? <span className="block text-xs text-muted-foreground">{candidate.attribution_reasons.slice(0, 3).join("；")}</span> : null}
                    {!candidate.authorization_eligible ? <span className="block text-xs text-warning">不可直接导入：请先批准对应根域；裸 IP 还需要单独的网段归属与授权能力。</span> : null}
                  </span>
                </label>)}</div>
              </section>
            ) : null}

            {confirmed ? <div className="space-y-3 rounded-control border border-success/30 bg-success-soft p-3">
              <div className="flex items-start gap-2 text-sm text-success"><CheckCircle2Icon className="mt-0.5 size-4 shrink-0" /><span>组织与授权工作区已经建立。公司流程只会扫描上方标记为“已授权”的根域名。</span></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={scanProfile} onValueChange={(value) => setScanProfile(value as "lite" | "standard" | "extensive")}>
                  <SelectTrigger className="bg-background sm:flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lite">快速收集</SelectItem>
                    <SelectItem value="standard">标准收集</SelectItem>
                    <SelectItem value="extensive">深度收集</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => void handleScan()} disabled={busy !== null}>{busy === "scan" ? <LoaderIcon className="size-4 animate-spin" /> : <PlayIcon className="size-4" />}启动公司收集</Button>
              </div>
            </div> : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy !== null}>{confirmed ? "完成" : "取消"}</Button>
          {!bundle ? <Button onClick={() => void handleIntake()} disabled={busy !== null || !name.trim()}>{busy === "intake" && <LoaderIcon className="size-4 animate-spin" />}建立待确认档案</Button> : !confirmed ? <Button onClick={() => void handleConfirm()} disabled={busy !== null || !canonicalName.trim() || selectedDomains.length === 0}>{busy === "confirm" && <LoaderIcon className="size-4 animate-spin" />}确认公司与授权范围</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}{required ? <span className="ml-1 text-destructive">*</span> : null}</Label>{children}</div>;
}

function attributionLabel(status: string) {
  if (status === "strong") return "高可信";
  if (status === "probable") return "较可信";
  if (status === "weak") return "弱线索";
  return "未核验";
}

function attributionVariant(status: string): "success" | "info" | "warning" | "outline" {
  if (status === "strong") return "success";
  if (status === "probable") return "info";
  if (status === "weak") return "warning";
  return "outline";
}

function infrastructureLabel(type: string) {
  const labels: Record<string, string> = {
    hostname: "域名资产",
    "domain-associated-ip": "域名关联 IP",
    "dedicated-ip-candidate": "疑似自有 IP",
    "unattributed-ip": "未归属 IP",
    "shared-hosting": "CDN / 云托管",
  };
  return labels[type] || "未知基础设施";
}

function cleanError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  return error.message.replace(/^\d+:/, "") || fallback;
}
