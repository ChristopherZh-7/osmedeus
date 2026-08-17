"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  ScanSearchIcon,
  WorkflowIcon,
  FolderOpenIcon,
  SettingsIcon,
  ShieldIcon,
  ClipboardCheckIcon,
  ScrollText as ScrollTextIcon,
  SquareFunction as SquareFunctionIcon,
  ArchiveIcon,
  BrainIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

const navigation = [
  {
    name: "控制台",
    href: "/",
    icon: LayoutDashboardIcon,
  },
  {
    name: "扫描任务",
    href: "/scans",
    icon: ScanSearchIcon,
  },
  {
    name: "工作流",
    href: "/workflows",
    icon: WorkflowIcon,
  },
  {
    name: "资产中心",
    href: "/inventory",
    icon: FolderOpenIcon,
  },
  {
    name: "产物",
    href: "/inventory/artifacts",
    icon: ArchiveIcon,
  },
  {
    name: "计划任务",
    href: "/schedules",
    icon: ClipboardCheckIcon,
  },
  {
    name: "事件日志",
    href: "/events",
    icon: ScrollTextIcon,
  },
  {
    name: "实用函数",
    href: "/utilities",
    icon: SquareFunctionIcon,
  },
  {
    name: "大模型调试台",
    href: "/llm",
    icon: BrainIcon,
  },
  {
    name: "智能渗透",
    href: "/agent-pentest",
    icon: ShieldCheckIcon,
  },
  {
    name: "设置",
    href: "/settings",
    icon: SettingsIcon,
  },
];

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border px-gutter py-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-control bg-primary">
              <ShieldIcon className="size-5 text-primary-foreground" />
            </div>
            <Link href="/" onClick={() => onOpenChange(false)} aria-label="返回首页">
              <Button variant="ghost" size="sm" className="gap-2 font-semibold">
                安全测试平台
              </Button>
            </Link>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5rem)]">
          <nav className="flex flex-col gap-1 p-4">
            {navigation.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-control px-3 py-2.5 text-sm transition-colors duration-150",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-5",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <Separator className="mx-4" />

        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
