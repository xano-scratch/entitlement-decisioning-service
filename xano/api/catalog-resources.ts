import { query, s, ref } from "@xanots/sdk";
import { catalogGroup } from "./groups.js";
import { serviceAccounts, resources } from "../tables.js";

/**
 * GET api:eds_catalog/resources — the resources the Access Console picks from.
 */
export const catalogResourcesQuery = query({
  name: "resources",
  verb: "GET",
  apiGroup: catalogGroup,
  auth: serviceAccounts,
  stack: [
    s.db.query({
      table: resources,
      sort: [{ sortBy: "label", dir: "asc" }],
      paging: { page: 1, per_page: 200, metadata: false },
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
