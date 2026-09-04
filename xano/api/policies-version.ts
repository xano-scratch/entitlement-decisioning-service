import { query, input, s, c, expr, col, inp, ref, auth, withFilters, fl } from "@xanots/sdk";
import { policiesGroup } from "./groups.js";
import { serviceAccounts, entitlementPolicies } from "../tables.js";
import { ROLES, ACTIONS, TIERS, OUTCOMES } from "../schema-enums.js";

/**
 * POST api:eds_policies/version — create a NEW draft version of a policy key.
 *
 * The version number is the count of existing versions for the key plus one
 * (versions are only ever added, so the count is the max). The new row is a
 * `draft` until it is activated; activating it is a separate, deliberate step.
 * Guarded: `policy_admin` only.
 */
export const policiesVersionQuery = query({
  name: "version",
  verb: "POST",
  apiGroup: policiesGroup,
  auth: serviceAccounts,
  input: {
    policy_key: input.text({ required: true }),
    effect: input.enum([...OUTCOMES], { required: true }),
    action: input.enum([...ACTIONS], { required: true }),
    applies_to_role: input.enum([...ROLES], { required: true }),
    max_tier: input.enum([...TIERS], { required: true }),
    priority: input.int({ required: true }),
    rationale: input.text({ required: true }),
  },
  stack: [
    s.db.get({ table: serviceAccounts, fieldName: "id", fieldValue: auth("id"), as: "caller" }),
    s.precondition({
      expr: expr(ref("caller.role"), "=", c.text("policy_admin")),
      error_type: "accessdenied",
      error: c.text("Only a policy_admin may create a policy version."),
    }),
    s.db.query({
      table: entitlementPolicies,
      where: expr(col("policy_key"), "=", inp("policy_key")),
      returnType: "count",
      as: "vcount",
    }),
    s.db.add({
      table: entitlementPolicies,
      row: {
        policy_key: inp("policy_key"),
        version: withFilters(ref("vcount"), fl.add(c.int(1))),
        status: "draft",
        effect: inp("effect"),
        action: inp("action"),
        applies_to_role: inp("applies_to_role"),
        max_tier: inp("max_tier"),
        priority: inp("priority"),
        rationale: inp("rationale"),
      },
      as: "created",
    }),
  ],
  response: ref("created"),
});
