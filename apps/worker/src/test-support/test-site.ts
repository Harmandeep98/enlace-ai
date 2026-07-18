import http from "node:http";
import type { AddressInfo } from "node:net";

export interface TestSite {
  baseUrl: string;
  close(): Promise<void>;
}

// A tiny, fully deterministic 2-page "site" served locally — real HTTP, real sitemap/robots.txt
// parsing, but no dependency on an external site staying up or unchanged (Website Ingestion
// spec §5's testing plan).
export async function startTestSite(): Promise<TestSite> {
  let baseUrl = "";
  const pages: Record<string, string> = {
    "/page-1":
      "<html><body><nav>Nav</nav><h1>Page One</h1><p>Our business hours are 9am to 5pm Monday through Friday.</p><footer>Footer</footer></body></html>",
    "/page-2":
      "<html><body><nav>Nav</nav><h1>Page Two</h1><p>We ship internationally to over fifty countries worldwide.</p><footer>Footer</footer></body></html>"
  };

  const server = http.createServer((req, res) => {
    if (req.url === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml`);
      return;
    }
    if (req.url === "/sitemap.xml") {
      const locs = Object.keys(pages)
        .map((path) => `<url><loc>${baseUrl}${path}</loc></url>`)
        .join("");
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset>${locs}</urlset>`);
      return;
    }
    const page = req.url ? pages[req.url] : undefined;
    if (page) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(page);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://localhost:${port}`;

  return {
    baseUrl,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}
