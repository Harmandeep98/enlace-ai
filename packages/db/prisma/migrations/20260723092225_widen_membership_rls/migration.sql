-- Widens memberships' RLS policy to also allow a user to see their own
-- membership rows regardless of workspace context — needed to resolve
-- "which workspace does this user belong to" without already knowing the
-- workspace (the original policy made that a chicken-and-egg query).
DROP POLICY tenant_isolation ON "memberships";
CREATE POLICY tenant_isolation ON "memberships"
  USING (
    "workspaceId" = current_setting('app.workspace_id', true)
    OR "userId" = current_setting('app.user_id', true)
  );