"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { listKnowledgeSources, createKnowledgeSource, deleteKnowledgeSource } from "@/lib/api-client";
import { usePolling } from "@/lib/use-polling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { KnowledgeSource } from "@/lib/types";

const STATUS_STYLES: Record<KnowledgeSource["syncStatus"], string> = {
  Pending: "bg-muted text-muted-foreground",
  Processing: "bg-primary/10 text-primary",
  Ready: "bg-primary/10 text-primary",
  Failed: "bg-destructive/10 text-destructive"
};

export default function KnowledgeSourcesPage() {
  const { workspaceId, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refetch = useCallback(() => {
    if (!workspaceId) return;
    listKnowledgeSources(workspaceId)
      .then((result) => {
        if (result.ok) {
          setSources(result.sources);
        } else {
          setError(result.message);
        }
      })
      .catch(() => setError("Could not reach the server."));
  }, [workspaceId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const hasInFlight = sources.some((s) => s.syncStatus === "Pending" || s.syncStatus === "Processing");
  usePolling(refetch, hasInFlight, 4000);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!workspaceId || !url.trim()) return;
    setSubmitting(true);
    const result = await createKnowledgeSource(workspaceId, url);
    setSubmitting(false);
    if (result.ok) {
      setUrl("");
      setSources((current) => [result.source, ...current]);
    } else {
      setError(result.message);
    }
  }

  async function handleDelete(sourceId: string) {
    if (!workspaceId) return;
    if (!window.confirm("Delete this source? It will stop being used to answer questions.")) return;
    const result = await deleteKnowledgeSource(sourceId, workspaceId);
    if (result.ok) {
      setSources((current) => current.filter((s) => s.id !== sourceId));
    } else {
      setError(result.message);
    }
  }

  if (workspaceLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (workspaceError) return <p className="text-destructive">{workspaceError}</p>;

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="url">Website URL</Label>
          <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        </div>
        <Button type="submit" disabled={submitting || !url.trim()}>
          {submitting ? "Adding..." : "Add source"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {sources.length === 0 && <p className="text-sm text-muted-foreground">No knowledge sources yet.</p>}
      <div className="space-y-2">
        {sources.map((source) => (
          <Card key={source.id} className="flex items-center justify-between p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{source.origin}</p>
              <p className="text-xs text-muted-foreground">
                {source.type} · {source.lastSyncedAt ? `Synced ${new Date(source.lastSyncedAt).toLocaleString()}` : "Never synced"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[source.syncStatus]}`}>
                {source.syncStatus}
              </span>
              <Button variant="outline" size="sm" onClick={() => handleDelete(source.id)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
