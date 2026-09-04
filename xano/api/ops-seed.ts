import { query, s, c, ref } from "@xanots/sdk";
import { opsGroup } from "./groups.js";
import {
  serviceAccounts,
  principals,
  resources,
  entitlementPolicies,
  grants,
  accessDecisions,
} from "../tables.js";

/**
 * POST api:eds_ops/seed — reset the demo to a known baseline.
 *
 * Public on purpose: it runs against a throwaway ephemeral so a reviewer (or
 * the frontend's "Reset demo" button) can repopulate without a token. It wipes
 * every table (id sequences reset) and rebuilds a data set that exercises all
 * seven decision rules:
 *   policy_allow, tier_ceiling, sod_conflict, explicit_deny, baseline_allow,
 *   no_grant, and inactive.
 *
 * The plaintext passwords here are throwaway demo credentials shown on the
 * login screen. They are not seed-table values, so `deploy --static` does not
 * treat them as secrets.
 */
export const opsSeedQuery = query({
  name: "seed",
  verb: "POST",
  apiGroup: opsGroup,
  auth: false,
  stack: [
    s.db.truncate({ table: accessDecisions, reset: true }),
    s.db.truncate({ table: grants, reset: true }),
    s.db.truncate({ table: entitlementPolicies, reset: true }),
    s.db.truncate({ table: resources, reset: true }),
    s.db.truncate({ table: principals, reset: true }),
    s.db.truncate({ table: serviceAccounts, reset: true }),

    // --- callers (the auth table) ---
    s.db.add({
      table: serviceAccounts,
      row: { email: "admin@wealthfirm.example", password: "admin-demo-pass", display_name: "Ada Admin", role: "policy_admin" },
      as: "sa_admin",
    }),
    s.db.add({
      table: serviceAccounts,
      row: { email: "service@wealthfirm.example", password: "service-demo-pass", display_name: "Trading Desk Service", role: "service_caller" },
    }),
    s.db.add({
      table: serviceAccounts,
      row: { email: "viewer@wealthfirm.example", password: "viewer-demo-pass", display_name: "Val Viewer", role: "viewer" },
    }),

    // --- principals (the people decided about) ---
    s.db.add({ table: principals, row: { full_name: "Alice Advisor", subject_role: "advisor", active: true }, as: "p_advisor" }),
    s.db.add({ table: principals, row: { full_name: "Otto Operations", subject_role: "ops", active: true }, as: "p_ops" }),
    s.db.add({ table: principals, row: { full_name: "Trina Trader", subject_role: "trader", secondary_role: "compliance", active: true }, as: "p_trader" }),
    s.db.add({ table: principals, row: { full_name: "Cora Compliance", subject_role: "compliance", active: true }, as: "p_compliance" }),
    s.db.add({ table: principals, row: { full_name: "Ian Inactive", subject_role: "advisor", active: false }, as: "p_inactive" }),

    // --- resources (what a decision is made against) ---
    s.db.add({ table: resources, row: { label: "Household Brokerage", resource_type: "account", account_tier: "retail" }, as: "r_retail_acct" }),
    s.db.add({ table: resources, row: { label: "Private Wealth Account", resource_type: "account", account_tier: "hnw" }, as: "r_hnw_acct" }),
    s.db.add({ table: resources, row: { label: "Institutional Mandate", resource_type: "account", account_tier: "institutional" }, as: "r_inst_acct" }),
    s.db.add({ table: resources, row: { label: "Daily Trade Blotter", resource_type: "trade_blotter", account_tier: "institutional" }, as: "r_blotter" }),
    s.db.add({ table: resources, row: { label: "Quarterly Client Report", resource_type: "client_report", account_tier: "hnw" }, as: "r_report" }),

    // --- baseline grants (role -> action -> resource_type allow-list) ---
    s.db.bulk.add({
      table: grants,
      items: c.array([
        { subject_role: "advisor", action: "view", resource_type: "account" },
        { subject_role: "advisor", action: "view", resource_type: "client_report" },
        { subject_role: "advisor", action: "export", resource_type: "client_report" },
        { subject_role: "ops", action: "view", resource_type: "account" },
        { subject_role: "ops", action: "withdraw", resource_type: "account" },
        { subject_role: "ops", action: "trade", resource_type: "account" },
        { subject_role: "ops", action: "view", resource_type: "trade_blotter" },
        { subject_role: "trader", action: "view", resource_type: "account" },
        { subject_role: "trader", action: "trade", resource_type: "account" },
        { subject_role: "trader", action: "trade", resource_type: "trade_blotter" },
        { subject_role: "trader", action: "view", resource_type: "trade_blotter" },
        { subject_role: "compliance", action: "view", resource_type: "account" },
        { subject_role: "compliance", action: "view", resource_type: "trade_blotter" },
        { subject_role: "compliance", action: "view", resource_type: "client_report" },
        { subject_role: "compliance", action: "export", resource_type: "client_report" },
      ]),
    }),

    // --- entitlement policies (versioned; exactly one active per key) ---
    s.db.add({
      table: entitlementPolicies,
      row: { policy_key: "advisor-view", version: 1, status: "active", effect: "allow", action: "view", applies_to_role: "advisor", max_tier: "institutional", priority: 10, rationale: "Advisors may view accounts at any tier." },
      as: "pol_advisor_view",
    }),
    s.db.add({
      table: entitlementPolicies,
      row: { policy_key: "ops-withdraw", version: 1, status: "active", effect: "allow", action: "withdraw", applies_to_role: "ops", max_tier: "hnw", priority: 10, rationale: "Operations may process withdrawals up to the HNW tier. Institutional withdrawals need escalation." },
      as: "pol_ops_withdraw",
    }),
    s.db.add({
      table: entitlementPolicies,
      row: { policy_key: "ops-trade-block", version: 1, status: "active", effect: "deny", action: "trade", applies_to_role: "ops", max_tier: "institutional", priority: 5, rationale: "Operations staff may never execute trades." },
    }),
    s.db.add({
      table: entitlementPolicies,
      row: { policy_key: "trader-trade", version: 1, status: "active", effect: "allow", action: "trade", applies_to_role: "trader", max_tier: "institutional", sod_conflict_role: "compliance", priority: 10, rationale: "Traders may trade at any tier, unless they also hold the compliance role (segregation of duties)." },
    }),
    s.db.add({
      table: entitlementPolicies,
      row: { policy_key: "compliance-view", version: 1, status: "active", effect: "allow", action: "view", applies_to_role: "compliance", max_tier: "institutional", priority: 10, rationale: "Compliance may view accounts at any tier for oversight." },
    }),

    // --- a couple of sample decisions so the audit trail is not empty ---
    s.db.add({
      table: accessDecisions,
      row: {
        principal_id: ref("p_advisor.id"), resource_id: ref("r_retail_acct.id"), action: "view",
        decision: "allow", deciding_policy_id: ref("pol_advisor_view.id"), policy_version: 1,
        rule: "policy_allow", reason: "Allowed by active policy advisor-view v1.", decided_by: ref("sa_admin.id"),
      },
    }),
    s.db.add({
      table: accessDecisions,
      row: {
        principal_id: ref("p_ops.id"), resource_id: ref("r_inst_acct.id"), action: "withdraw",
        decision: "deny", deciding_policy_id: ref("pol_ops_withdraw.id"), policy_version: 1,
        rule: "tier_ceiling", reason: "Denied by tier ceiling. Policy ops-withdraw v1 permits up to hnw tier, but the resource is institutional tier.", decided_by: ref("sa_admin.id"),
      },
    }),
  ],
  response: {
    ok: c.bool(true),
    service_accounts: c.int(3),
    principals: c.int(5),
    resources: c.int(5),
    grants: c.int(15),
    policies: c.int(5),
    decisions: c.int(2),
  },
});
