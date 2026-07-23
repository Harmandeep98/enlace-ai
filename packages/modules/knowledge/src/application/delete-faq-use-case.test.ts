import { describe, expect, it } from "vitest";
import { FaqNotFoundError } from "../domain/errors.js";
import type { FaqEntry } from "../domain/entities.js";
import type { CreateFaqInput, FaqRepository } from "./ports.js";
import { DeleteFaqUseCase } from "./delete-faq-use-case.js";

class FakeFaqRepository implements FaqRepository {
  constructor(private readonly existing: boolean) {}

  async create(_input: CreateFaqInput): Promise<FaqEntry> {
    throw new Error("not used in this test");
  }

  async listByWorkspace(): Promise<FaqEntry[]> {
    throw new Error("not used in this test");
  }

  async delete(): Promise<boolean> {
    return this.existing;
  }

  async findBestMatch(): Promise<FaqEntry | undefined> {
    throw new Error("not used in this test");
  }
}

describe("DeleteFaqUseCase", () => {
  it("deletes an existing FAQ", async () => {
    const useCase = new DeleteFaqUseCase(new FakeFaqRepository(true));

    await expect(useCase.execute({ faqId: "faq-1", workspaceId: "workspace-1" })).resolves.toBeUndefined();
  });

  it("throws FaqNotFoundError when nothing was deleted", async () => {
    const useCase = new DeleteFaqUseCase(new FakeFaqRepository(false));

    await expect(useCase.execute({ faqId: "missing", workspaceId: "workspace-1" })).rejects.toThrow(FaqNotFoundError);
  });
});
