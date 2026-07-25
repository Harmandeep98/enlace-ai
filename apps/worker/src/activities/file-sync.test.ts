import { describe, expect, it, vi } from "vitest";

vi.mock("pdf-parse", () => ({
  default: vi.fn(async () => ({ text: "Extracted PDF text." }))
}));
vi.mock("mammoth", () => ({
  default: { extractRawText: vi.fn(async () => ({ value: "Extracted DOCX text." })) }
}));

const { extractText } = await import("./file-sync.js");

describe("extractText", () => {
  it("extracts text from a Pdf buffer via pdf-parse", async () => {
    const text = await extractText(Buffer.from("fake pdf bytes"), "Pdf");
    expect(text).toBe("Extracted PDF text.");
  });

  it("extracts text from a Docx buffer via mammoth", async () => {
    const text = await extractText(Buffer.from("fake docx bytes"), "Docx");
    expect(text).toBe("Extracted DOCX text.");
  });

  it("reads a Txt buffer as plain UTF-8", async () => {
    const text = await extractText(Buffer.from("Plain text content."), "Txt");
    expect(text).toBe("Plain text content.");
  });

  it("reads a Markdown buffer as plain UTF-8", async () => {
    const text = await extractText(Buffer.from("# A heading\n\nSome markdown."), "Markdown");
    expect(text).toBe("# A heading\n\nSome markdown.");
  });
});
