"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPlaceholderPage() {
  const { data: session, isPending } = useSession();

  return (
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
      <main className="mx-auto max-w-3xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>You're in.</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This is a placeholder — conversations, knowledge, integrations, and settings land here in future slices.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
