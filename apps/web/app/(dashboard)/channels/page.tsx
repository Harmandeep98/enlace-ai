"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { getChannel, updateAllowedDomains } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { ChannelConnection } from "@/lib/types";

function embedSnippet(publicKey: string): string {
  return `<script src="https://widget.enlace.ai/v1/loader.js" data-workspace-key="${publicKey}" async></script>`;
}

export default function ChannelsPage() {
  const { workspaceId, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  const [channel, setChannel] = useState<ChannelConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    getChannel(workspaceId)
      .then((result) => {
        if (result.ok) {
          setChannel(result.channel);
        } else {
          setError(result.message);
        }
      })
      .catch(() => setError("Could not reach the server."));
  }, [workspaceId]);

  async function saveDomains(domains: string[]) {
    if (!workspaceId) return;
    setSaving(true);
    const result = await updateAllowedDomains(workspaceId, domains);
    setSaving(false);
    if (result.ok) {
      setChannel(result.channel);
    } else {
      setError(result.message);
    }
  }

  async function handleAddDomain(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!channel || !newDomain.trim()) return;
    await saveDomains([...channel.allowedDomains, newDomain.trim()]);
    setNewDomain("");
  }

  async function handleRemoveDomain(domain: string) {
    if (!channel) return;
    if (!window.confirm(`Remove "${domain}" from allowed domains?`)) return;
    await saveDomains(channel.allowedDomains.filter((d) => d !== domain));
  }

  function handleCopy() {
    if (!channel) return;
    navigator.clipboard.writeText(embedSnippet(channel.publicKey));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (workspaceLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (workspaceError) return <p className="text-destructive">{workspaceError}</p>;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!channel) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
        <p className="text-sm text-muted-foreground">Configure the chat widget for your website.</p>
      </div>

      <Card className="space-y-3 p-4">
        <div>
          <Label>Embed snippet</Label>
          <p className="text-xs text-muted-foreground">
            Paste this before the closing <code>&lt;/body&gt;</code> tag on your site. The widget itself isn&apos;t live yet — coming soon.
          </p>
        </div>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{embedSnippet(channel.publicKey)}</pre>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy snippet"}
        </Button>
      </Card>

      <Card className="space-y-3 p-4">
        <Label>Allowed domains</Label>
        <p className="text-xs text-muted-foreground">Only these domains can use your widget key.</p>
        <form onSubmit={handleAddDomain} className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="example.com" />
          </div>
          <Button type="submit" disabled={saving || !newDomain.trim()}>
            {saving ? "Saving..." : "Add domain"}
          </Button>
        </form>
        {channel.allowedDomains.length === 0 && <p className="text-sm text-muted-foreground">No domains allowed yet.</p>}
        <div className="space-y-2">
          {channel.allowedDomains.map((domain) => (
            <div key={domain} className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="font-mono text-sm">{domain}</span>
              <Button variant="outline" size="sm" onClick={() => handleRemoveDomain(domain)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
