import { query, s, ref } from "@xanots/sdk";
import { catalogGroup } from "./groups.js";
import { serviceAccounts, principals } from "../tables.js";

/**
 * GET api:eds_catalog/principals — the principals the Access Console picks from.
 * (The spec's endpoint list had no catalog read; the console needs one to be
 * demoable, so it is added here.)
 */
export const catalogPrincipalsQuery = query({
  name: "principals",
  verb: "GET",
  apiGroup: catalogGroup,
  auth: serviceAccounts,
  stack: [
    s.db.query({
      table: principals,
      sort: [{ sortBy: "full_name", dir: "asc" }],
      paging: { page: 1, per_page: 200, metadata: false },
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
