import { PrismaClient } from "@prisma/client";

// Connects as the restricted enlace_app role (docs/06-database-design.md §2), NOT the
// admin role DATABASE_URL points at — that one is for `prisma migrate`/`generate` only.
// This is the client every use of @enlace/db at runtime (app code, integration tests) gets.
export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_APP_URL } }
});
