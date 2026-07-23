"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [{ href: "/conversations", label: "Conversations" }];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const pathname = usePathname();

  return (
    <WorkspaceProvider>
      <div className="min-h-screen bg-muted/30">
        <header className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
          <div className="text-lg font-semibold tracking-tight">Enlace Ai</div>
          {!isPending && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{session?.user.email}</span>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            </div>
          )}
        </header>
        <div className="flex">
          <nav className="w-56 shrink-0 border-r border-border bg-background p-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium",
                  pathname?.startsWith(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
