"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoaderIcon, AlertCircleIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading: authLoading, isAuthenticated } = useAuth();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("请输入用户名");
      return;
    }

    if (!password.trim()) {
      setError("请输入密码");
      return;
    }

    setIsSubmitting(true);

    try {
      await login(username, password);
      toast.success("欢迎回来！", {
        description: "您已成功登录。",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || authLoading;

  if (authLoading || isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <LoaderIcon className="mr-2 size-4 animate-spin" />
        <span>正在跳转……</span>
      </div>
    );
  }

  return (
    <>
    <Card className="w-full shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-6 flex size-28 items-center justify-center rounded-2xl">
          <ShieldCheckIcon className="size-20 text-primary" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl">欢迎回来</CardTitle>
        <CardDescription>
          登录安全测试平台
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-control bg-destructive-soft p-3 text-sm text-destructive">
              <AlertCircleIcon className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

        </CardContent>

        <CardFooter className="flex flex-col gap-4 mt-4">
          <p className="text-center text-xs text-muted-foreground">
            默认密码位于{" "}
            <strong className="font-semibold">$HOME/osmedeus-base/osm-settings.yaml</strong>。
          </p>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <LoaderIcon className="mr-2 size-4 animate-spin" />
                正在登录……
              </>
            ) : (
              "登录"
            )}
          </Button>
          <div className="flex items-center justify-center gap-3">
            <ThemeToggle variant="outline" size="sm" className="rounded-full px-3" ariaLabel="切换主题" label="主题" />
          </div>
        </CardFooter>
      </form>
    </Card>
    </>
  );
}
