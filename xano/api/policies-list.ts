import { query, s, ref } from "@xanots/sdk";
import { policiesGroup } from "./groups.js";
import { serviceAccounts, entitlementPolicies } from "../tables.js";

/**
 * GET api:eds_policies/list — every policy version, ordered by key then version
 * so the frontend can group them and show which one is active. Any
 * authenticated caller may read.
 */
export const policiesListQuery = query({
  name: "list",
  verb: "GET",
  apiGroup: policiesGroup,
  auth: serviceAccounts,
  stack: [
    s.db.query({
      table: entitlementPolicies,
      sort: [
        { sortBy: "policy_key", dir: "asc" },
        { sortBy: "version", dir: "asc" },
      ],
      paging: { page: 1, per_page: 200, metadata: false },
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
