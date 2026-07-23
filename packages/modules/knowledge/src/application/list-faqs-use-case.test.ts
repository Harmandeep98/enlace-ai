import { describe, expect, it } from "vitest";
import type { FaqEntry } from "../domain/entities.js";
import type { CreateFaqInput, FaqRepository } from "./ports.js";
import { ListFaqsUseCase } from "./list-faqs-use-case.js";

class FakeFaqRepository implements FaqRepository {
  constructor(private readonly entries: FaqEntry[]) {}

  async create(_input: CreateFaqInput): Promise<FaqEntry> {
    throw new Error("not used in this test");
  }

  async listByWorkspace(workspaceId: string): Promise<FaqEntry[]> {
    return this.entries.filter((entry) => entry.workspaceId === workspaceId);
  }

  async delete(): Promise<boolean> {
    throw new Error("not used in this test");
  }

  async findBestMatch(): Promise<FaqEntry | undefined> {
    throw new Error("not used in this test");
  }
}

describe("ListFaqsUseCase", () => {
  it("returns the FAQ entries for the given workspace", async () => {
    const entries: FaqEntry[] = [
      { id: "faq-1", workspaceId: "workspace-1", question: "Q1", answer: "A1" },
      { id: "faq-2", workspaceId: "workspace-2", question: "Q2", answer: "A2" }
    ];
    const useCase = new ListFaqsUseCase(new FakeFaqRepository(entries));

    const result = await useCase.execute({ workspaceId: "workspace-1" });

    expect(result).toEqual([{ id: "faq-1", workspaceId: "workspace-1", question: "Q1", answer: "A1" }]);
  });
});
