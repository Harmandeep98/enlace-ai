import { describe, expect, it } from "vitest";
import { toWorkspaceSlug } from "./workspace-slug.js";

describe("toWorkspaceSlug", () => {
  it("lowercases and hyphenates a workspace name", () => {
    expect(toWorkspaceSlug("Acme Support Co")).toBe("acme-support-co");
  });

  it("strips characters that aren't alphanumeric or hyphen", () => {
    expect(toWorkspaceSlug("Acme & Co!!")).toBe("acme-co");
  });

  it("collapses repeated separators and trims leading/trailing hyphens", () => {
    expect(toWorkspaceSlug("  Acme   Co  ")).toBe("acme-co");
  });
});
