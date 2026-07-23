import { describe, expect, it } from "vitest";
import type { FaqEntry } from "../domain/entities.js";
import type { CreateFaqInput, FaqRepository } from "./ports.js";
import { CreateFaqUseCase } from "./create-faq-use-case.js";

class FakeFaqRepository implements FaqRepository {
  public created: CreateFaqInput[] = [];

  async create(input: CreateFaqInput): Promise<FaqEntry> {
    this.created.push(input);
    return { id: "faq-1", workspaceId: input.workspaceId, question: input.question, answer: input.answer };
  }

  async listByWorkspace(): Promise<FaqEntry[]> {
    throw new Error("not used in this test");
  }

  async delete(): Promise<boolean> {
    throw new Error("not used in this test");
  }

  async findBestMatch(): Promise<FaqEntry | undefined> {
    throw new Error("not used in this test");
  }
}

describe("CreateFaqUseCase", () => {
  it("delegates creation to the repository", async () => {
    const repo = new FakeFaqRepository();
    const useCase = new CreateFaqUseCase(repo);

    const result = await useCase.execute({ workspaceId: "workspace-1", question: "What are your hours?", answer: "9am-5pm." });

    expect(result.id).toBe("faq-1");
    expect(repo.created).toEqual([{ workspaceId: "workspace-1", question: "What are your hours?", answer: "9am-5pm." }]);
  });
});
