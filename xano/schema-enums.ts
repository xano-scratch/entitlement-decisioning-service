// Shared enum vocabularies — one source of truth for the columns AND the inputs
// that must agree (a policy's action must match a grant's action must match a
// decision's action). Kept as `as const` so `f.enum`/`input.enum` infer the
// exact member union.

/** The roles a firm principal (the person being decided ABOUT) can hold. */
export const ROLES = ["advisor", "ops", "trader", "compliance"] as const;

/** The actions an access check is made against. */
export const ACTIONS = ["view", "trade", "withdraw", "export"] as const;

/** Account tiers, lowest to highest sensitivity (see the tier_rank function). */
export const TIERS = ["retail", "hnw", "institutional"] as const;

/** The kinds of resource a decision is made against. */
export const RESOURCE_TYPES = ["account", "trade_blotter", "client_report"] as const;

/** The RBAC roles a calling service account can hold. */
export const CALLER_ROLES = ["policy_admin", "service_caller", "viewer"] as const;

/** A policy's effect and a decision's outcome. */
export const OUTCOMES = ["allow", "deny"] as const;

/** A policy version's lifecycle. Exactly one version per key is `active`. */
export const POLICY_STATUS = ["draft", "active", "retired"] as const;

/**
 * Which rule in the waterfall decided a request. Stored on every audit row so
 * the decision is self-describing without re-running the engine.
 */
export const RULES = [
  "inactive",
  "no_grant",
  "explicit_deny",
  "tier_ceiling",
  "sod_conflict",
  "baseline_allow",
  "policy_allow",
] as const;
