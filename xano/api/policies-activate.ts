import { query, input, s, c, expr, col, inp, ref, auth } from "@xanots/sdk";
import { policiesGroup } from "./groups.js";
import { serviceAccounts, entitlementPolicies } from "../tables.js";

/**
 * PATCH api:eds_policies/activate/{id} — activate one policy version and retire
 * whatever version of the same key was active, in one step. This is the demo
 * money-shot: activating a new version flips a previously recorded decision on
 * the next check. Guarded: `policy_admin` only.
 */
export const policiesActivateQuery = query({
  name: "activate/{id}",
  verb: "PATCH",
  apiGroup: policiesGroup,
  auth: serviceAccounts,
  input: { id: input.int({ required: true }) },
  stack: [
    s.db.get({ table: serviceAccounts, fieldName: "id", fieldValue: auth("id"), as: "caller" }),
    s.precondition({
      expr: expr(ref("caller.role"), "=", c.text("policy_admin")),
      error_type: "accessdenied",
      error: c.text("Only a policy_admin may activate a policy version."),
    }),
    s.db.get({ table: entitlementPolicies, fieldName: "id", fieldValue: inp("id"), as: "target" }),
    s.precondition({
      expr: expr(ref("target", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("No policy version with that id."),
    }),
    // retire any currently-active version of the same key
    s.db.query({
      table: entitlementPolicies,
      where: [
        expr(col("policy_key"), "=", ref("target.policy_key")),
        expr(col("status"), "=", c.text("active")),
        expr(col("id"), "!=", ref("target.id")),
      ],
      as: "prior_actives",
    }),
    s.foreach({
      list: ref("prior_actives"),
      as: "pa",
      body: [
        s.db.edit({
          table: entitlementPolicies,
          fieldName: "id",
          fieldValue: ref("pa.id"),
          row: { status: "retired" },
        }),
      ],
    }),
    s.db.edit({
      table: entitlementPolicies,
      fieldName: "id",
      fieldValue: ref("target.id"),
      row: { status: "active" },
      as: "activated",
    }),
  ],
  response: ref("activated"),
});
