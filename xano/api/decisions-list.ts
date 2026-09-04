import { query, input, s, cmp, col, inp, ref } from "@xanots/sdk";
import { decisionGroup } from "./groups.js";
import { serviceAccounts, accessDecisions } from "../tables.js";
import { OUTCOMES } from "../schema-enums.js";

/**
 * GET api:eds_decision/decisions — the audit trail, newest first.
 *
 * Optional `principal_id` and `decision` filters use `ignoreEmpty`, so an
 * absent filter drops its predicate (returns everything) rather than matching
 * nothing. Any authenticated caller may read the trail.
 */
export const decisionsListQuery = query({
  name: "decisions",
  verb: "GET",
  apiGroup: decisionGroup,
  auth: serviceAccounts,
  input: {
    principal_id: input.int({ required: false }),
    decision: input.enum([...OUTCOMES], { required: false }),
  },
  stack: [
    s.db.query({
      table: accessDecisions,
      where: [
        cmp(col("principal_id"), "=", inp("principal_id"), { ignoreEmpty: true }),
        cmp(col("decision"), "=", inp("decision"), { ignoreEmpty: true }),
      ],
      sort: [{ sortBy: "created_at", dir: "desc" }],
      paging: { page: 1, per_page: 100, metadata: false },
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
