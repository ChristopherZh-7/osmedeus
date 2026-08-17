import type { Metadata } from "next";
import { ThemeProvider } from "@/providers/theme-provider";
import { ColorVarsProvider } from "@/providers/color-vars-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "安全测试平台",
  description: "安全扫描、资产管理与智能渗透测试平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      {/* The page plane sits *under* the app canvas: chrome and auth screens
          show `--og-page-bg`, and `SidebarInset` paints `bg-background` over
          it for the dashboard column. */}
      <body className="min-h-screen bg-page antialiased">
        {/*
          No `disableTransitionOnChange`: the palette swap is cross-faded
          instead, by `components/layout/theme-toggle.tsx` setting
          `data-theme-transition` on <html> for the length of the swap.
        */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ColorVarsProvider />
          <AuthProvider>
            {children}
            <Toaster
              position="bottom-right"
              richColors
              toastOptions={{
                className: "border border-border",
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
