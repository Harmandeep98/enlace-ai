import { describe, expect, it } from "vitest";
import { findUncoveredTenantTables } from "./check-rls-coverage.js";

describe("findUncoveredTenantTables", () => {
  it("does not flag a tenant-shaped table that has an RLS policy", () => {
    const tenantColumns = [{ table_name: "memberships", column_name: "workspaceId" }];
    const policies = [{ tablename: "memberships" }];
    expect(findUncoveredTenantTables(tenantColumns, policies)).toEqual([]);
  });

  it("returns the table name when a workspaceId column has no matching policy", () => {
    const tenantColumns = [{ table_name: "channel_connections", column_name: "workspaceId" }];
    const policies: { tablename: string }[] = [];
    expect(findUncoveredTenantTables(tenantColumns, policies)).toEqual(["channel_connections"]);
  });

  it("ignores tables without a workspaceId column", () => {
    const tenantColumns = [{ table_name: "users", column_name: "email" }];
    const policies: { tablename: string }[] = [];
    expect(findUncoveredTenantTables(tenantColumns, policies)).toEqual([]);
  });
});
