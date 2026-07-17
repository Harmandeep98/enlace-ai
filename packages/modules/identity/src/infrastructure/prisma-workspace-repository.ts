import { Prisma, prisma } from "@enlace/db";
import { WorkspaceSlugTakenError } from "../domain/errors.js";
import type { Workspace } from "../domain/entities.js";
import type { CreateWorkspaceInput, WorkspaceRepository } from "../application/ports.js";

export class PrismaWorkspaceRepository implements WorkspaceRepository {
  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    try {
      const row = await prisma.workspace.create({ data: input });
      return { id: row.id, name: row.name, slug: row.slug, planTier: row.planTier, status: row.status };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new WorkspaceSlugTakenError(input.slug);
      }
      throw error;
    }
  }

  async findBySlug(slug: string): Promise<Workspace | undefined> {
    const row = await prisma.workspace.findUnique({ where: { slug } });
    if (!row) return undefined;
    return { id: row.id, name: row.name, slug: row.slug, planTier: row.planTier, status: row.status };
  }
}
