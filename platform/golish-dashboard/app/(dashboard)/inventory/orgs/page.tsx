"use client";

import * as React from "react";
import { useOrg } from "@/providers/org-provider";
import { createOrg, deleteOrg, updateOrg } from "@/lib/api/orgs";
import { fetchCompanies } from "@/lib/api/companies";
import { fetchWorkspacesList } from "@/lib/api/assets";
import type { Org } from "@/lib/types/org";
import type { CompanyBundle } from "@/lib/types/company";
import { AssignWorkspacesDialog } from "@/components/orgs/assign-workspaces-dialog";
import { CompanyIntakeDialog } from "@/components/orgs/company-intake-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BuildingIcon,
  PlusIcon,
  RefreshCcwIcon,
  MoreHorizontalIcon,
  FolderPlusIcon,
  PencilIcon,
  Trash2Icon,
  GlobeIcon,
  CheckIcon,
} from "lucide-react";
import { toast } from "sonner";

export default function OrgsPage() {
  const { orgs, activeOrg, isLoading, error, selectOrg, refresh } = useOrg();

  const [workspaceNames, setWorkspaceNames] = React.useState<string[]>([]);
  const [companies, setCompanies] = React.useState<CompanyBundle[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [companyOpen, setCompanyOpen] = React.useState(false);
  const [companyTarget, setCompanyTarget] = React.useState<CompanyBundle | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<Org | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Org | null>(null);
  const [assignTarget, setAssignTarget] = React.useState<Org | null>(null);

  const [newName, setNewName] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [renameValue, setRenameValue] = React.useState("");
  const [purge, setPurge] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Workspace names power the assignment dialog. Fetched unscoped so an org can
  // be given workspaces that currently belong to another one.
  const loadWorkspaces = React.useCallback(async () => {
    try {
      const result = await fetchWorkspacesList({ limit: 500, org: "" });
      setWorkspaceNames(result.items.map((w) => w.name).filter(Boolean));
    } catch {
      setWorkspaceNames([]);
    }
  }, []);

  const loadCompanies = React.useCallback(async () => {
    try {
      setCompanies(await fetchCompanies());
    } catch {
      setCompanies([]);
    }
  }, []);

  React.useEffect(() => {
    void loadWorkspaces();
    void loadCompanies();
  }, [loadCompanies, loadWorkspaces]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createOrg({ name, description: newDescription.trim() || undefined });
      toast.success(`已创建组织 ${name}`);
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      await refresh();
    } catch (err) {
      toast.error(cleanError(err, "创建组织失败"));
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name || name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    setBusy(true);
    try {
      await updateOrg(renameTarget.uuid, { name });
      toast.success(`已重命名为 ${name}`);
      setRenameTarget(null);
      await refresh();
    } catch (err) {
      toast.error(cleanError(err, "重命名组织失败"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteOrg(deleteTarget.uuid, purge);
      toast.success(
        purge
          ? `已删除 ${deleteTarget.name} 及其数据`
          : `已删除 ${deleteTarget.name}，其数据已移至默认组织`
      );
      if (activeOrg?.uuid === deleteTarget.uuid) {
        selectOrg(null);
        return; // selectOrg reloads
      }
      setDeleteTarget(null);
      setPurge(false);
      await refresh();
    } catch (err) {
      toast.error(cleanError(err, "删除组织失败"));
    } finally {
      setBusy(false);
    }
  };

  const handleAssigned = async () => {
    setAssignTarget(null);
    await refresh();
    await loadWorkspaces();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BuildingIcon className="size-5 text-primary" />
              组织
            </CardTitle>
            <CardDescription>
              将多个工作区归入同一组织，以跨工作区查询资产、漏洞和扫描。未归属组织的数据属于
              <span className="font-medium">默认组织</span>；未选择组织时，控制台将展示所有组织的数据。
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={isLoading}>
              <RefreshCcwIcon className="size-4" />
              刷新
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              新建组织
            </Button>
            <Button size="sm" onClick={() => { setCompanyTarget(null); setCompanyOpen(true); }}>
              <BuildingIcon className="size-4" />
              按公司录入
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {error ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              无法加载组织。当前服务可能不支持组织 API。
            </p>
          ) : isLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : orgs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无组织。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead className="text-right">工作区</TableHead>
                  <TableHead className="text-right">资产</TableHead>
                  <TableHead className="text-right">漏洞</TableHead>
                  <TableHead className="text-right">运行记录</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((org) => {
                  const isActive = activeOrg?.uuid === org.uuid;
                  return (
                    <TableRow key={org.uuid} className={isActive ? "bg-primary-soft/40" : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => selectOrg(isActive ? null : { uuid: org.uuid, name: org.name })}
                            className="flex items-center gap-2 text-left hover:underline"
                            title={isActive ? "清除组织范围" : `将控制台范围切换到 ${org.name}`}
                          >
                            {isActive ? (
                              <CheckIcon className="size-4 text-primary" />
                            ) : (
                              <BuildingIcon className="size-4 text-muted-foreground" />
                            )}
                            <span className="font-medium">{org.name}</span>
                          </button>
                          {org.is_default && (
                            <Badge variant="secondary" className="text-[10px]">
                              默认组织
                            </Badge>
                          )}
                          {org.tags.map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px]">
                              {t}
                            </Badge>
                          ))}
                        </div>
                        {org.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{org.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {org.stats?.total_workspaces ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {org.stats?.total_assets ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {org.stats?.total_vulns ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {org.stats?.total_runs ?? 0}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontalIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setAssignTarget(org)}>
                              <FolderPlusIcon className="size-4" />
                              分配工作区
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={org.is_default}
                              onSelect={() => {
                                setRenameTarget(org);
                                setRenameValue(org.name);
                              }}
                            >
                              <PencilIcon className="size-4" />
                              重命名
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={org.is_default}
                              className="text-destructive focus:text-destructive"
                              onSelect={() => {
                                setDeleteTarget(org);
                                setPurge(false);
                              }}
                            >
                              <Trash2Icon className="size-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!isLoading && !error && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <GlobeIcon className="size-3.5" />
              {activeOrg
                ? `当前范围为 ${activeOrg.name}。再次点击其名称可显示全部组织。`
                : "当前显示全部组织。点击组织名称可将控制台限定到该组织。"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">公司档案</CardTitle>
          <CardDescription>公司是法律主体，确认后关联组织；只有已授权根域名会成为工作区。</CardDescription>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">尚未录入公司档案。</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>公司名称</TableHead><TableHead>状态</TableHead><TableHead>根域名</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
              <TableBody>{companies.map((company) => (
                <TableRow key={company.profile.uuid}>
                  <TableCell><div className="font-medium">{company.profile.canonical_name}</div><div className="text-xs text-muted-foreground">录入名：{company.profile.input_name}</div></TableCell>
                  <TableCell><Badge variant={company.profile.verification_status === "confirmed" ? "success" : "warning"}>{company.profile.verification_status === "confirmed" ? "已确认" : "待确认"}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{company.domains.map((domain) => domain.domain).join(", ") || "-"}</TableCell>
                  <TableCell><Button variant="outline" size="sm" onClick={() => { setCompanyTarget(company); setCompanyOpen(true); }}>{company.profile.verification_status === "confirmed" ? "查看" : "继续"}</Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建组织</DialogTitle>
            <DialogDescription>
              创建组织并为其分配工作区。现有扫描数据会自动归组，无需重新扫描。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-name">名称</Label>
              <Input
                id="org-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="acme"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-description">描述</Label>
              <Input
                id="org-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="例如：艾克米公司"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>
              取消
            </Button>
            <Button onClick={() => void handleCreate()} disabled={busy || !newName.trim()}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名组织</DialogTitle>
            <DialogDescription>
              重命名不会移动任何数据，工作区仍保持当前归属。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-rename">名称</Label>
            <Input
              id="org-rename"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)} disabled={busy}>
              取消
            </Button>
            <Button onClick={() => void handleRename()} disabled={busy || !renameValue.trim()}>
              重命名
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setPurge(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除 {deleteTarget?.name}</DialogTitle>
            <DialogDescription>
              默认情况下，该组织的工作区、资产、漏洞和运行记录会移至默认组织；数据不会丢失，只会改变分组。
            </DialogDescription>
          </DialogHeader>

          <label className="flex items-start gap-2 rounded-control border border-destructive/40 bg-destructive/5 p-3">
            <Checkbox
              checked={purge}
              onCheckedChange={(v) => setPurge(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium text-destructive">同时删除其数据</span>
              <span className="block text-xs text-muted-foreground">
                永久删除 {deleteTarget?.stats?.total_workspaces ?? 0} 工作区、{" "}
                {deleteTarget?.stats?.total_assets ?? 0} 资产、{" "}
                {deleteTarget?.stats?.total_vulns ?? 0} 漏洞和{" "}
                {deleteTarget?.stats?.total_runs ?? 0} 运行记录。此操作无法撤销。
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>
              {purge ? "删除组织及其数据" : "删除组织"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {assignTarget && (
        <AssignWorkspacesDialog
          org={assignTarget}
          allWorkspaces={workspaceNames}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => void handleAssigned()}
        />
      )}
      <CompanyIntakeDialog
        open={companyOpen}
        onOpenChange={(next) => { setCompanyOpen(next); if (!next) setCompanyTarget(null); }}
        initialBundle={companyTarget}
        onCompleted={async () => {
          await refresh();
          await loadWorkspaces();
          await loadCompanies();
        }}
      />
    </div>
  );
}

/** Strip the `status:` prefix the http layer prepends to error messages. */
function cleanError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const match = err.message.match(/^\d+:(.*)$/);
  return (match ? match[1] : err.message) || fallback;
}
