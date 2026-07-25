import * as cheerio from "cheerio";
import robotsParserImport from "robots-parser";
import { GeminiEmbeddingAdapter } from "@enlace/ai-gateway";
import { PrismaDocumentChunkRepository, PrismaKnowledgeSourceRepository } from "@enlace/knowledge";
import type { KnowledgeSyncStatus } from "@enlace/knowledge";
import { chunkEmbedAndStore } from "./chunk-and-embed.js";

// robots-parser's own .d.ts ships a conflicting ambient `declare module 'robots-parser'`
// alongside its real typed export, which confuses TypeScript's NodeNext resolution into
// treating the import as a non-callable namespace. Cast through the real shape instead.
interface Robot {
  isAllowed(url: string, ua?: string): boolean | undefined;
  getSitemaps(): string[];
}
const robotsParser = robotsParserImport as unknown as (url: string, robotsTxt: string) => Robot;

// Website Ingestion spec §2 — a safety/cost guard against a runaway crawl on an
// unexpectedly large site.
const MAX_PAGES = 500;
const CRAWLER_USER_AGENT = "EnlaceBot/1.0";

const knowledgeSources = new PrismaKnowledgeSourceRepository();
const embeddingAdapter = new GeminiEmbeddingAdapter();
const documentChunks = new PrismaDocumentChunkRepository(embeddingAdapter);

export async function markSyncStatus(
  sourceId: string,
  workspaceId: string,
  status: KnowledgeSyncStatus,
  lastSyncedAt?: Date
): Promise<void> {
  await knowledgeSources.updateSyncStatus(sourceId, workspaceId, status, lastSyncedAt);
}

// Discovers a site's pages via its sitemap (found via robots.txt's Sitemap: line, falling back
// to the conventional /sitemap.xml path), filters out anything robots.txt disallows for our
// crawler, and caps the result at MAX_PAGES.
export async function discoverPages(url: string): Promise<string[]> {
  const origin = new URL(url).origin;
  const robotsTxtUrl = `${origin}/robots.txt`;

  let robotsTxtContent = "";
  try {
    const res = await fetch(robotsTxtUrl);
    if (res.ok) robotsTxtContent = await res.text();
  } catch {
    // No robots.txt reachable — robots-parser with empty content allows everything, matching
    // "no robots.txt means no restrictions" per the standard.
  }
  const robots = robotsParser(robotsTxtUrl, robotsTxtContent);

  const sitemapUrl = robots.getSitemaps()[0] ?? `${origin}/sitemap.xml`;
  const sitemapRes = await fetch(sitemapUrl);
  if (!sitemapRes.ok) {
    // No sitemap at all — fall back to just the one URL the workspace provided.
    return robots.isAllowed(url, CRAWLER_USER_AGENT) === false ? [] : [url];
  }

  const sitemapXml = await sitemapRes.text();
  // Deliberately simple regex extraction, not a full XML parser — sufficient for a flat
  // sitemap.xml (the common case for the SMB sites this platform targets). A nested
  // sitemap-index (sitemap-of-sitemaps) file is a named gap, not handled here.
  const pageUrls = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]?.trim()).filter((u): u is string => Boolean(u));

  const allowed = pageUrls.filter((pageUrl) => robots.isAllowed(pageUrl, CRAWLER_USER_AGENT) !== false);
  return allowed.slice(0, MAX_PAGES);
}

// Never throws for a page-content problem (bad fetch, empty extracted text) — returns
// { success: false } instead, so one broken page doesn't fail the whole crawl (docs/12 §2).
// The embed+store step is deliberately NOT wrapped the same way — see Global Constraints on
// rate-limit resilience via Temporal's own activity retry.
export async function ingestPage(workspaceId: string, sourceId: string, pageUrl: string): Promise<{ success: boolean }> {
  let text: string;
  try {
    const res = await fetch(pageUrl);
    if (!res.ok) return { success: false };
    const html = await res.text();

    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, noscript").remove();
    text = $("body")
      .text()
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!text) return { success: false };
  } catch {
    return { success: false };
  }

  return chunkEmbedAndStore(embeddingAdapter, documentChunks, workspaceId, sourceId, text);
}

export async function finalizeSync(sourceId: string, workspaceId: string, totalPages: number, failedPages: number): Promise<void> {
  const failureRate = totalPages === 0 ? 1 : failedPages / totalPages;
  const status: KnowledgeSyncStatus = failureRate > 0.5 ? "Failed" : "Ready";
  await knowledgeSources.updateSyncStatus(sourceId, workspaceId, status, new Date());
}
