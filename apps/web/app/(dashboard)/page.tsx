"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function DashboardPlaceholderPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <main className="p-8">Loading...</main>;
  }

  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Signed in as {session?.user.email}</h1>
      <p className="mt-2 text-muted-foreground">This is a placeholder — the real dashboard is future work.</p>
      <Button className="mt-4" variant="outline" onClick={() => signOut()}>
        Sign out
      </Button>
    </main>
  );
}
