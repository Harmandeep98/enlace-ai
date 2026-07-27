"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/lib/workspace-context";
import { listKnowledgeSources, createKnowledgeSource, deleteKnowledgeSource, uploadKnowledgeSource } from "@/lib/api-client";
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

const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt", "md"];
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export default function KnowledgeSourcesPage() {
  const { workspaceId, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!workspaceId || !file) return;

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError("Only PDF, DOCX, TXT, and MD files are supported.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File exceeds the 20MB limit.");
      return;
    }

    setUploading(true);
    const result = await uploadKnowledgeSource(workspaceId, file);
    setUploading(false);
    if (result.ok) {
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
      <div className="grid gap-4 sm:grid-cols-2">
        <form onSubmit={handleAdd} className="flex items-end gap-2 rounded-lg border border-border p-4">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="url">Website URL</Label>
            <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <Button type="submit" disabled={submitting || !url.trim()}>
            {submitting ? "Adding..." : "Add source"}
          </Button>
        </form>
        <div className="flex items-center gap-2 rounded-lg border border-border p-4">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="file">Upload a file</Label>
            <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, or MD — up to 20MB.</p>
          </div>
          <input ref={fileInputRef} id="file" type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={handleFileSelected} />
          <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? "Uploading..." : "Choose file"}
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {sources.length === 0 && <p className="text-sm text-muted-foreground">No knowledge sources yet.</p>}
      <div className="space-y-2">
        {sources.map((source) => (
          <Link key={source.id} href={`/knowledge/${source.id}`} className="block">
            <Card className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(source.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
