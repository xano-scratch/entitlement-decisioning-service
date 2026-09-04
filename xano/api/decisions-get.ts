import { query, input, s, c, expr, col, inp, ref } from "@xanots/sdk";
import { decisionGroup } from "./groups.js";
import { serviceAccounts, accessDecisions, entitlementPolicies } from "../tables.js";

/**
 * GET api:eds_decision/decisions/{id} — one decision joined to the exact policy
 * version that decided it (the "which version decided this" view).
 *
 * The join is a `db.query returnType:"single"` on the policy id rather than a
 * `db.get_by_id`: a baseline decision stores `deciding_policy_id = 0`, and a
 * search matching no row binds `null` (typed `Row | null`), whereas
 * `get_by_id` would reject the 0 sentinel with a 400.
 */
export const decisionGetQuery = query({
  name: "decisions/{id}",
  verb: "GET",
  apiGroup: decisionGroup,
  auth: serviceAccounts,
  input: { id: input.int({ required: true }) },
  stack: [
    s.db.get({ table: accessDecisions, fieldName: "id", fieldValue: inp("id"), as: "d" }),
    s.precondition({
      expr: expr(ref("d", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("No decision with that id."),
    }),
    s.db.query({
      table: entitlementPolicies,
      where: expr(col("id"), "=", ref("d.deciding_policy_id")),
      returnType: "single",
      as: "pol",
    }),
  ],
  response: {
    decision: ref("d"),
    deciding_policy: ref("pol"),
  },
});
