"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { ThemeToggle } from "./theme-toggle";
import { OrgSwitcher } from "./org-switcher";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOutIcon, UserIcon, CircleUserRound } from "lucide-react";
import { getBreadcrumbs } from "./breadcrumbs-util";
import { getRouteMeta } from "./route-meta";
import { getServerInfo } from "@/lib/api/system";
import { isDemoMode } from "@/lib/api/demo-mode";

export function Topbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [serverUp, setServerUp] = React.useState<boolean | null>(null);
  const [demoMode, setDemoMode] = React.useState<boolean>(false);

  const crumbs = React.useMemo(() => getBreadcrumbs(pathname || "/"), [pathname]);
  const meta = React.useMemo(() => getRouteMeta(pathname || "/"), [pathname]);
  const isLegacyBrandUser = Boolean(
    user && /osmedeus/i.test(`${user.name ?? ""} ${user.username ?? ""} ${user.email ?? ""}`)
  );
  const displayUserName = isLegacyBrandUser
    ? "安全管理员"
    : user?.name ?? user?.username;
  const displayUserDetail = isLegacyBrandUser ? "本地账户" : user?.email;

  React.useEffect(() => {
    let mounted = true;
    const demo = isDemoMode();
    setDemoMode(demo);
    if (demo) {
      setServerUp(false);
      return () => {
        mounted = false;
      };
    }
    const check = async () => {
      try {
        await getServerInfo();
        if (!mounted) return;
        setServerUp(true);
      } catch {
        if (!mounted) return;
        setServerUp(false);
      }
    };
    check();
    const id = setInterval(check, 60000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between gap-4 border-b border-border bg-background px-gutter text-sm">
      <div className="flex items-center gap-2">
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((c, idx) => (
              <React.Fragment key={`${c.label}-${idx}`}>
                <BreadcrumbItem>
                  {c.isCurrent ? (
                    <BreadcrumbPage className="flex items-center gap-2">
                      {c.icon && (
                        <span className="inline-flex size-6 items-center justify-center rounded-control bg-primary-soft text-primary-fg">
                          <c.icon className="size-4" />
                        </span>
                      )}
                      {meta.title || c.label}
                      {meta.description && (
                        <span className="text-muted-foreground">
                          {" · "}{meta.description}
                        </span>
                      )}
                    </BreadcrumbPage>
                  ) : (
                    c.href ? (
                      <Link href={c.href} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                        {c.icon && (
                          <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary-soft text-primary">
                            <c.icon className="size-4" />
                          </span>
                        )}
                        {c.label}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        {c.icon && (
                          <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary-soft text-primary">
                            <c.icon className="size-4" />
                          </span>
                        )}
                        {c.label}
                      </span>
                    )
                  )}
                </BreadcrumbItem>
                {idx < crumbs.length - 1 && <BreadcrumbSeparator />}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right side actions */}
      <div className="hidden md:flex items-center gap-2">
        <OrgSwitcher />
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              aria-label="服务状态"
              className="inline-flex items-center gap-2 rounded-control border border-border bg-muted px-2.5 py-1"
            >
              <span
                className={`inline-block size-2 rounded-full ${
                  serverUp === null
                    ? "bg-faint"
                    : serverUp
                      ? "bg-success"
                      : demoMode
                        ? "bg-warning"
                        : "bg-destructive"
                }`}
              />
              <span className="text-xs">
                {serverUp === null
                  ? "检查中……"
                  : serverUp
                    ? "正常"
                    : demoMode
                      ? "演示模式"
                      : "离线"}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {serverUp === null
              ? "正在检查服务……"
              : serverUp
                ? "服务运行正常"
                : demoMode
                  ? "当前使用模拟数据运行"
                  : "服务已离线"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ThemeToggle variant="outline" className="size-8" />
          </TooltipTrigger>
          <TooltipContent>主题</TooltipContent>
        </Tooltip>

        {user && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative size-8 p-0"
                    aria-label="用户菜单"
                  >
                    <Avatar className="size-8 rounded-control">
                      <AvatarFallback className="bg-muted text-muted-foreground rounded-control">
                        <CircleUserRound className="size-5" />
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">个人资料</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{displayUserName}</p>
                  {displayUserDetail && (
                    <p className="text-xs text-muted-foreground">{displayUserDetail}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <UserIcon className="mr-2 size-4" />
                  个人设置
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOutIcon className="mr-2 size-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
