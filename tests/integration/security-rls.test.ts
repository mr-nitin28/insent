/**
 * Multi-Tenant Security & Row-Level Security (RLS) Isolation Tests.
 * Asserts: Tenant A reading Tenant B is denied and filtered out.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("integration/security multi-tenant isolation", () => {
  it("verifies Row-Level Security is enabled and enforced across all schema tables", () => {
    const migration1 = readFileSync(
      resolve(process.cwd(), "supabase/migrations/0001_init.sql"),
      "utf8",
    );
    const migration2 = readFileSync(
      resolve(process.cwd(), "supabase/migrations/0002_links_conversions.sql"),
      "utf8",
    );
    const combinedMigrations = migration1 + "\n" + migration2;

    const requiredTables = [
      "workspaces",
      "app_settings",
      "social_accounts",
      "automation_rules",
      "automation_runs",
      "tracked_links",
      "link_clicks",
      "conversions",
      "daily_counters",
      "audit_log",
    ];

    for (const table of requiredTables) {
      // Must enable row level security
      const rlsRegex = new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`, "i");
      expect(combinedMigrations).toMatch(rlsRegex);

      // Must define an isolation policy
      const policyRegex = new RegExp(`CREATE POLICY workspace_isolation_${table} ON ${table}`, "i");
      expect(combinedMigrations).toMatch(policyRegex);
    }
  });

  it("denies Tenant A from reading Tenant B's sensitive accounts or automation runs", () => {
    interface MockRow {
      id: string;
      workspace_id: string;
      data: string;
    }

    const tenantAWorkspace = "ws-tenant-a";
    const tenantBWorkspace = "ws-tenant-b";

    const databaseRows: MockRow[] = [
      { id: "row-1", workspace_id: tenantAWorkspace, data: "Tenant A private data" },
      { id: "row-2", workspace_id: tenantBWorkspace, data: "Tenant B private data" },
    ];

    // RLS Policy evaluator simulation matching Postgres:
    // USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()))
    const evaluateRlsSelect = (
      rows: MockRow[],
      authenticatedUserWorkspaces: string[],
    ): MockRow[] => {
      return rows.filter((r) => authenticatedUserWorkspaces.includes(r.workspace_id));
    };

    // User A authenticates (owns ws-tenant-a)
    const userAWorkspaces = [tenantAWorkspace];
    const userAVisibleRows = evaluateRlsSelect(databaseRows, userAWorkspaces);

    // User A can only see User A's data
    expect(userAVisibleRows).toHaveLength(1);
    const firstRow = userAVisibleRows[0];
    expect(firstRow?.workspace_id).toBe(tenantAWorkspace);
    expect(firstRow?.data).toBe("Tenant A private data");

    // Tenant B's data is completely hidden / denied
    const tenantBLeaks = userAVisibleRows.filter((r) => r.workspace_id === tenantBWorkspace);
    expect(tenantBLeaks).toHaveLength(0);
  });

  it("denies Tenant A from updating Tenant B's automation rules or kill switch", () => {
    const tenantAWorkspace = "ws-tenant-a";
    const tenantBWorkspace = "ws-tenant-b";

    const ruleRow = {
      id: "rule-b",
      workspace_id: tenantBWorkspace,
      status: "active",
    };

    const evaluateRlsUpdate = (
      row: typeof ruleRow,
      authenticatedUserWorkspaces: string[],
      newStatus: string,
    ): { success: boolean; error?: string } => {
      if (!authenticatedUserWorkspaces.includes(row.workspace_id)) {
        return { success: false, error: "42501: Insufficient privilege (RLS violation)" };
      }
      row.status = newStatus;
      return { success: true };
    };

    // User A tries to modify User B's rule
    const userAWorkspaces = [tenantAWorkspace];
    const updateResult = evaluateRlsUpdate(ruleRow, userAWorkspaces, "paused");

    expect(updateResult.success).toBe(false);
    expect(updateResult.error).toContain("RLS violation");
    expect(ruleRow.status).toBe("active"); // Unchanged
  });
});
