import { query, input, s, c, expr, and, or, col, inp, ref, auth, obj, withFilters, fl } from "@xanots/sdk";
import { decisionGroup } from "./groups.js";
import {
  serviceAccounts,
  principals,
  resources,
  grants,
  entitlementPolicies,
  accessDecisions,
} from "../tables.js";
import { tierRankFn } from "../functions/tier-rank.js";
import { ACTIONS } from "../schema-enums.js";

/**
 * POST api:eds_decision/check-access — THE decision engine.
 *
 * The waterfall, in order, first decisive rule wins:
 *   1. inactive principal            -> deny
 *   2. no baseline grant             -> deny (default deny)
 *   3. any active deny policy        -> deny (an explicit deny wins outright)
 *   4. the winning active allow policy, then:
 *        a. resource tier over the policy ceiling -> deny
 *        b. a segregation-of-duty conflict        -> deny
 *        c. otherwise                             -> allow
 *   5. a baseline grant with no policy -> allow
 *
 * Every call writes one access_decisions row. The response is read back OFF
 * that row, so its decision/reason/rule/version fields carry the real schema
 * types instead of the `unknown` a set_var response would.
 *
 * Guarded: only a `service_caller` or `policy_admin` may ask.
 */
export const checkAccessQuery = query({
  name: "check-access",
  verb: "POST",
  apiGroup: decisionGroup,
  auth: serviceAccounts,
  input: {
    principal_id: input.int({ required: true }),
    resource_id: input.int({ required: true }),
    action: input.enum([...ACTIONS], { required: true }),
  },
  stack: [
    // --- RBAC: the caller must be allowed to ask ---
    s.db.get({ table: serviceAccounts, fieldName: "id", fieldValue: auth("id"), as: "caller" }),
    s.precondition({
      expr: or(
        expr(ref("caller.role"), "=", c.text("service_caller")),
        expr(ref("caller.role"), "=", c.text("policy_admin")),
      ),
      error_type: "accessdenied",
      error: c.text("Only a service_caller or policy_admin may check access."),
    }),

    // --- load the subject and the resource ---
    s.db.get({ table: principals, fieldName: "id", fieldValue: inp("principal_id"), as: "principal" }),
    s.precondition({
      expr: expr(ref("principal", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("No principal with that id."),
    }),
    s.db.get({ table: resources, fieldName: "id", fieldValue: inp("resource_id"), as: "resource" }),
    s.precondition({
      expr: expr(ref("resource", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("No resource with that id."),
    }),

    // --- accumulators (default deny) ---
    s.set_var("decision", c.text("deny")),
    s.set_var("rule", c.text("no_grant")),
    s.set_var("reason", c.text("")),
    s.set_var("policy_id", c.int(0)),
    s.set_var("policy_version", c.int(0)),

    s.conditional({
      when: expr(ref("principal.active"), "=", c.bool(false)),
      then: [
        s.update_var("decision", c.text("deny")),
        s.update_var("rule", c.text("inactive")),
        s.update_var("reason", c.text("The principal is inactive, so every action is denied.")),
      ],
      else: [
        // 2. baseline grant?
        s.db.query({
          table: grants,
          where: [
            expr(col("subject_role"), "=", ref("principal.subject_role")),
            expr(col("action"), "=", inp("action")),
            expr(col("resource_type"), "=", ref("resource.resource_type")),
          ],
          returnType: "count",
          as: "grant_count",
        }),
        s.conditional({
          when: expr(ref("grant_count"), "=", c.int(0)),
          then: [
            s.update_var("decision", c.text("deny")),
            s.update_var("rule", c.text("no_grant")),
            s.update_var(
              "reason",
              c.text("No baseline grant lets this role take this action on this kind of resource."),
            ),
          ],
          else: [
            // 3. an active deny policy wins outright
            s.db.query({
              table: entitlementPolicies,
              where: [
                expr(col("status"), "=", c.text("active")),
                expr(col("applies_to_role"), "=", ref("principal.subject_role")),
                expr(col("action"), "=", inp("action")),
                expr(col("effect"), "=", c.text("deny")),
              ],
              returnType: "count",
              as: "deny_count",
            }),
            s.conditional({
              when: expr(ref("deny_count"), ">", c.int(0)),
              then: [
                s.db.query({
                  table: entitlementPolicies,
                  where: [
                    expr(col("status"), "=", c.text("active")),
                    expr(col("applies_to_role"), "=", ref("principal.subject_role")),
                    expr(col("action"), "=", inp("action")),
                    expr(col("effect"), "=", c.text("deny")),
                  ],
                  sort: [{ sortBy: "priority", dir: "asc" }],
                  returnType: "single",
                  as: "deny_pol",
                }),
                s.update_var("decision", c.text("deny")),
                s.update_var("rule", c.text("explicit_deny")),
                s.update_var("policy_id", ref("deny_pol.id")),
                s.update_var("policy_version", ref("deny_pol.version")),
                s.update_var(
                  "reason",
                  withFilters(
                    c.text("Denied by active policy "),
                    fl.concat(ref("deny_pol.policy_key")),
                    fl.concat(c.text(" v")),
                    fl.concat(ref("deny_pol.version")),
                    fl.concat(c.text(": ")),
                    fl.concat(ref("deny_pol.rationale")),
                  ),
                ),
              ],
              else: [
                // 4. the winning active allow policy
                s.db.query({
                  table: entitlementPolicies,
                  where: [
                    expr(col("status"), "=", c.text("active")),
                    expr(col("applies_to_role"), "=", ref("principal.subject_role")),
                    expr(col("action"), "=", inp("action")),
                    expr(col("effect"), "=", c.text("allow")),
                  ],
                  sort: [{ sortBy: "priority", dir: "asc" }],
                  returnType: "single",
                  as: "allow_pol",
                }),
                s.conditional({
                  when: expr(ref("allow_pol", { safe: true }), "=", c.null()),
                  then: [
                    // 5. baseline grant, no specific policy
                    s.update_var("decision", c.text("allow")),
                    s.update_var("rule", c.text("baseline_allow")),
                    s.update_var(
                      "reason",
                      c.text("Allowed by a baseline role grant. No specific policy applies."),
                    ),
                  ],
                  else: [
                    s.update_var("policy_id", ref("allow_pol.id")),
                    s.update_var("policy_version", ref("allow_pol.version")),
                    // compare the resource tier against the policy ceiling
                    s.function.run({ fn: tierRankFn, input: { tier: ref("resource.account_tier") }, as: "rr" }),
                    s.function.run({ fn: tierRankFn, input: { tier: ref("allow_pol.max_tier") }, as: "mr" }),
                    s.conditional({
                      when: expr(ref("rr.rank"), ">", ref("mr.rank")),
                      then: [
                        // 4a. over the tier ceiling
                        s.update_var("decision", c.text("deny")),
                        s.update_var("rule", c.text("tier_ceiling")),
                        s.update_var(
                          "reason",
                          withFilters(
                            c.text("Denied by tier ceiling. Policy "),
                            fl.concat(ref("allow_pol.policy_key")),
                            fl.concat(c.text(" v")),
                            fl.concat(ref("allow_pol.version")),
                            fl.concat(c.text(" permits up to ")),
                            fl.concat(ref("allow_pol.max_tier")),
                            fl.concat(c.text(" tier, but the resource is ")),
                            fl.concat(ref("resource.account_tier")),
                            fl.concat(c.text(" tier.")),
                          ),
                        ),
                      ],
                      else: [
                        s.conditional({
                          // 4b. segregation of duties
                          when: and(
                            expr(ref("allow_pol.sod_conflict_role", { safe: true }), "!=", c.null()),
                            or(
                              expr(ref("principal.subject_role"), "=", ref("allow_pol.sod_conflict_role")),
                              expr(ref("principal.secondary_role", { safe: true }), "=", ref("allow_pol.sod_conflict_role")),
                            ),
                          ),
                          then: [
                            s.update_var("decision", c.text("deny")),
                            s.update_var("rule", c.text("sod_conflict")),
                            s.update_var(
                              "reason",
                              withFilters(
                                c.text("Denied by segregation of duties. Policy "),
                                fl.concat(ref("allow_pol.policy_key")),
                                fl.concat(c.text(" v")),
                                fl.concat(ref("allow_pol.version")),
                                fl.concat(c.text(" forbids anyone who also holds the ")),
                                fl.concat(ref("allow_pol.sod_conflict_role")),
                                fl.concat(c.text(" role.")),
                              ),
                            ),
                          ],
                          else: [
                            // 4c. allowed by the policy
                            s.update_var("decision", c.text("allow")),
                            s.update_var("rule", c.text("policy_allow")),
                            s.update_var(
                              "reason",
                              withFilters(
                                c.text("Allowed by active policy "),
                                fl.concat(ref("allow_pol.policy_key")),
                                fl.concat(c.text(" v")),
                                fl.concat(ref("allow_pol.version")),
                                fl.concat(c.text(".")),
                              ),
                            ),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // --- write the audit row and read the response back off it ---
    s.db.add({
      table: accessDecisions,
      row: {
        principal_id: inp("principal_id"),
        resource_id: inp("resource_id"),
        action: inp("action"),
        decision: ref("decision"),
        deciding_policy_id: ref("policy_id"),
        policy_version: ref("policy_version"),
        rule: ref("rule"),
        reason: ref("reason"),
        decided_by: auth("id"),
      },
      as: "audit",
    }),
  ],
  response: {
    decision_id: ref("audit.id"),
    decision: ref("audit.decision"),
    rule: ref("audit.rule"),
    reason: ref("audit.reason"),
    action: ref("audit.action"),
    deciding_policy_id: ref("audit.deciding_policy_id"),
    policy_version: ref("audit.policy_version"),
    principal: obj({
      id: ref("principal.id"),
      full_name: ref("principal.full_name"),
      subject_role: ref("principal.subject_role"),
      secondary_role: ref("principal.secondary_role", { safe: true }),
    }),
    resource: obj({
      id: ref("resource.id"),
      label: ref("resource.label"),
      resource_type: ref("resource.resource_type"),
      account_tier: ref("resource.account_tier"),
    }),
  },
});
