import { workspace } from "@xanots/sdk";

import {
  serviceAccounts,
  principals,
  resources,
  entitlementPolicies,
  grants,
  accessDecisions,
} from "./tables.js";
import {
  authGroup,
  decisionGroup,
  policiesGroup,
  catalogGroup,
  opsGroup,
} from "./api/groups.js";
import { tierRankFn } from "./functions/tier-rank.js";

import { loginQuery } from "./api/auth-login.js";
import { checkAccessQuery } from "./api/check-access.js";
import { decisionsListQuery } from "./api/decisions-list.js";
import { decisionGetQuery } from "./api/decisions-get.js";
import { policiesListQuery } from "./api/policies-list.js";
import { policiesVersionQuery } from "./api/policies-version.js";
import { policiesActivateQuery } from "./api/policies-activate.js";
import { catalogPrincipalsQuery } from "./api/catalog-principals.js";
import { catalogResourcesQuery } from "./api/catalog-resources.js";
import { opsSeedQuery } from "./api/ops-seed.js";

/**
 * The Entitlement Decisioning Service backend.
 *
 * A central, governed API a wealth firm's internal apps call to ask "can this
 * principal, in this role, take this action on this account?" Access rules live
 * as versioned data (entitlement_policies) in ONE readable layer instead of
 * being copied across every internal tool. Authorization is API-layer RBAC (an
 * auth table + create_auth_token + per-endpoint role preconditions), never
 * row-level security.
 */
export default workspace("entitlement-decisioning-service")
  .registerTables([
    serviceAccounts,
    principals,
    resources,
    entitlementPolicies,
    grants,
    accessDecisions,
  ])
  .registerApiGroups([authGroup, decisionGroup, policiesGroup, catalogGroup, opsGroup])
  .registerFunctions([tierRankFn])
  .registerQueries([
    loginQuery,
    checkAccessQuery,
    decisionsListQuery,
    decisionGetQuery,
    policiesListQuery,
    policiesVersionQuery,
    policiesActivateQuery,
    catalogPrincipalsQuery,
    catalogResourcesQuery,
    opsSeedQuery,
  ]);
