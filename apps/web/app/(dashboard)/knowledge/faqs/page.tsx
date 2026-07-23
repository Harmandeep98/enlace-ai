"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { listFaqs, createFaq, deleteFaq } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { FaqEntry } from "@/lib/types";

export default function KnowledgeFaqsPage() {
  const { workspaceId, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  const [faqs, setFaqs] = useState<FaqEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    listFaqs(workspaceId)
      .then((result) => {
        if (result.ok) {
          setFaqs(result.faqs);
        } else {
          setError(result.message);
        }
      })
      .catch(() => setError("Could not reach the server."));
  }, [workspaceId]);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!workspaceId || !question.trim() || !answer.trim()) return;
    setSubmitting(true);
    const result = await createFaq(workspaceId, question, answer);
    setSubmitting(false);
    if (result.ok) {
      setQuestion("");
      setAnswer("");
      setFaqs((current) => [result.faq, ...current]);
    } else {
      setError(result.message);
    }
  }

  async function handleDelete(faqId: string) {
    if (!workspaceId) return;
    if (!window.confirm("Delete this FAQ entry?")) return;
    const result = await deleteFaq(faqId, workspaceId);
    if (result.ok) {
      setFaqs((current) => current.filter((f) => f.id !== faqId));
    } else {
      setError(result.message);
    }
  }

  if (workspaceLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (workspaceError) return <p className="text-destructive">{workspaceError}</p>;

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="question">Question</Label>
          <Input id="question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What are your business hours?" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="answer">Answer</Label>
          <Input id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="We're open 9am-5pm Mon-Fri." />
        </div>
        <Button type="submit" disabled={submitting || !question.trim() || !answer.trim()}>
          {submitting ? "Adding..." : "Add FAQ"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {faqs.length === 0 && <p className="text-sm text-muted-foreground">No FAQs yet.</p>}
      <div className="space-y-2">
        {faqs.map((faq) => (
          <Card key={faq.id} className="flex items-start justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="font-medium">{faq.question}</p>
              <p className="text-sm text-muted-foreground">{faq.answer}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleDelete(faq.id)} className="shrink-0">
              Delete
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
