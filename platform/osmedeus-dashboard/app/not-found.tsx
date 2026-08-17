import Link from "next/link";
import { ArrowLeftIcon, ShieldAlertIcon } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-6 py-16">
      <div className="w-full max-w-md rounded-card border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary-fg">
          <ShieldAlertIcon className="size-9" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold tracking-widest text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">页面未找到</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          您访问的页面不存在、已被移动，或当前地址无效。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          返回首页
        </Link>
      </div>
    </main>
  );
}
