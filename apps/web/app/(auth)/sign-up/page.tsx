"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/api-client";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const result = await signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      name: String(form.get("name")),
      workspaceName: String(form.get("workspaceName"))
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push("/sign-in");
  }

  return (
    <AuthSplitLayout>
      <div className="mb-8 space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">Create your workspace</h2>
        <p className="text-sm text-muted-foreground">Start in under a minute — no credit card required.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" placeholder="Ada Lovelace" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@company.com" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" minLength={8} placeholder="At least 8 characters" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="workspaceName">Workspace name</Label>
          <Input id="workspaceName" name="workspaceName" placeholder="Acme Support Co" required />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="mt-2" disabled={submitting}>
          {submitting ? "Creating..." : "Create workspace"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have a workspace?{" "}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
