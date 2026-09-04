import { table, f } from "@xanots/sdk";
import {
  ROLES,
  ACTIONS,
  TIERS,
  RESOURCE_TYPES,
  CALLER_ROLES,
  OUTCOMES,
  POLICY_STATUS,
  RULES,
} from "./schema-enums.js";

/**
 * service_accounts — the AUTH table. These are the callers of the entitlement
 * API (other internal systems and the admins who curate policy), not the people
 * being decided about. RBAC role gates what each caller may do.
 */
export const serviceAccounts = table({
  name: "service_accounts",
  auth: true,
  schema: {
    email: f.email({ required: true }),
    // Taken as plaintext on signup/login and hashed on write by the column.
    password: f.password({ required: true }),
    display_name: f.text({ required: true }),
    role: f.enum([...CALLER_ROLES], { required: true }),
  },
  index: [{ type: "unique", fields: [{ name: "email" }] }],
});

/**
 * principals — the firm users a decision is made ABOUT. `secondary_role` lets a
 * principal hold a second role (e.g. a trader who also sits in compliance),
 * which is what a segregation-of-duty rule tests against.
 */
export const principals = table({
  name: "principals",
  schema: {
    full_name: f.text({ required: true }),
    subject_role: f.enum([...ROLES], { required: true }),
    secondary_role: f.enum([...ROLES], { nullable: true }),
    active: f.bool({ required: true, default: true }),
  },
});

/** resources — the accounts, blotters, and reports a decision is made against. */
export const resources = table({
  name: "resources",
  schema: {
    label: f.text({ required: true }),
    resource_type: f.enum([...RESOURCE_TYPES], { required: true }),
    account_tier: f.enum([...TIERS], { required: true }),
  },
});

/**
 * entitlement_policies — the VERSIONED rules, the heart of the service. A
 * `policy_key` has many `version` rows; exactly one is `active` at a time. A
 * rule matches on (applies_to_role, action) and then refines with a tier ceiling
 * and an optional segregation-of-duty conflict.
 */
export const entitlementPolicies = table({
  name: "entitlement_policies",
  schema: {
    policy_key: f.text({ required: true }),
    version: f.int({ required: true }),
    status: f.enum([...POLICY_STATUS], { required: true, default: "draft" }),
    effect: f.enum([...OUTCOMES], { required: true }),
    action: f.enum([...ACTIONS], { required: true }),
    applies_to_role: f.enum([...ROLES], { required: true }),
    // The highest account tier this rule permits.
    max_tier: f.enum([...TIERS], { required: true }),
    // If set, deny when the principal ALSO holds this role.
    sod_conflict_role: f.enum([...ROLES], { nullable: true }),
    // Lower number wins when several active rules match.
    priority: f.int({ required: true }),
    rationale: f.text({ required: true }),
  },
  index: [{ type: "btree", fields: [{ name: "policy_key" }] }],
});

/**
 * grants — the baseline role→action allow-list. A request that has no baseline
 * grant is denied before any policy is consulted (default deny).
 */
export const grants = table({
  name: "grants",
  schema: {
    subject_role: f.enum([...ROLES], { required: true }),
    action: f.enum([...ACTIONS], { required: true }),
    resource_type: f.enum([...RESOURCE_TYPES], { required: true }),
  },
});

/**
 * access_decisions — the AUDIT trail. Every check-access call writes one row
 * naming the outcome, the rule that fired, and the exact policy version that
 * decided it. `deciding_policy_id` uses a 0 sentinel for a baseline/no-policy
 * decision (read it with a field-match get or a query, never get_by_id).
 */
export const accessDecisions = table({
  name: "access_decisions",
  schema: {
    principal_id: f.tableRef(principals, { required: true }),
    resource_id: f.tableRef(resources, { required: true }),
    action: f.enum([...ACTIONS], { required: true }),
    decision: f.enum([...OUTCOMES], { required: true }),
    deciding_policy_id: f.tableRef(entitlementPolicies, { required: true, default: 0 }),
    policy_version: f.int({ required: true, default: 0 }),
    rule: f.enum([...RULES], { required: true }),
    reason: f.text({ required: true }),
    decided_by: f.tableRef(serviceAccounts, { required: true }),
  },
});
