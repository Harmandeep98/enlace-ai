import { prisma } from "../src/client.js";

export interface TableColumnRow {
  table_name: string;
  column_name: string;
}

export interface PolicyRow {
  tablename: string;
}

export function findUncoveredTenantTables(
  tenantColumns: TableColumnRow[],
  policies: PolicyRow[]
): string[] {
  const coveredTables = new Set(policies.map((p) => p.tablename));
  const tenantTables = new Set(
    tenantColumns.filter((c) => c.column_name === "workspaceId").map((c) => c.table_name)
  );
  return [...tenantTables].filter((table) => !coveredTables.has(table));
}

export async function checkRlsCoverage(): Promise<string[]> {
  const tenantColumns = await prisma.$queryRaw<TableColumnRow[]>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'workspaceId'
  `;
  const policies = await prisma.$queryRaw<PolicyRow[]>`
    SELECT tablename FROM pg_policies WHERE schemaname = 'public'
  `;
  return findUncoveredTenantTables(tenantColumns, policies);
}

async function main() {
  const uncovered = await checkRlsCoverage();
  if (uncovered.length > 0) {
    console.error(`Tenant tables missing RLS policy: ${uncovered.join(", ")}`);
    process.exit(1);
  }
  console.log("All tenant tables have an RLS policy.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
