"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/lib/workspace-context";
import { getKnowledgeSource } from "@/lib/api-client";
import type { KnowledgeSourceDetail } from "@/lib/types";

const STATUS_STYLES: Record<KnowledgeSourceDetail["syncStatus"], string> = {
  Pending: "bg-muted text-muted-foreground",
  Processing: "bg-primary/10 text-primary",
  Ready: "bg-primary/10 text-primary",
  Failed: "bg-destructive/10 text-destructive"
};

export default function KnowledgeSourceDetailPage() {
  const params = useParams<{ id: string }>();
  const { workspaceId, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  const [source, setSource] = useState<KnowledgeSourceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    getKnowledgeSource(params.id, workspaceId)
      .then((result) => {
        if (result.ok) {
          setSource(result.source);
        } else {
          setError(result.message);
        }
      })
      .catch(() => setError("Could not reach the server."));
  }, [workspaceId, params.id]);

  if (workspaceLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (workspaceError) return <p className="text-destructive">{workspaceError}</p>;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!source) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/knowledge" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to Sources
        </Link>
        <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">{source.origin}</h1>
      </div>
      <dl className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</dt>
          <dd className="mt-1">{source.type}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</dt>
          <dd className="mt-1">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[source.syncStatus]}`}>
              {source.syncStatus}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Last synced</dt>
          <dd className="mt-1">{source.lastSyncedAt ? new Date(source.lastSyncedAt).toLocaleString() : "Never"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Chunks stored</dt>
          <dd className="mt-1">{source.chunkCount}</dd>
        </div>
      </dl>
    </div>
  );
}
