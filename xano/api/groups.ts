import { apiGroup } from "@xanots/sdk";

// Each group pins a `canonical` slug so the public path is stable and
// `getPath()` resolves in the browser bundle without a lock. The slugs are
// namespaced (`eds_`) because a canonical is unique across the whole Xano
// instance, not per workspace — namespacing avoids a collision with a sibling
// scratch app that also serves an "auth" or "policies" group.

export const authGroup = apiGroup({
  name: "auth",
  canonical: "eds_auth",
  description: "Sign a service account in and mint a bearer token.",
});

export const decisionGroup = apiGroup({
  name: "decision",
  canonical: "eds_decision",
  description: "The entitlement decision engine and its audit trail.",
});

export const policiesGroup = apiGroup({
  name: "policies",
  canonical: "eds_policies",
  description: "Read, version, and activate the entitlement policies.",
});

export const catalogGroup = apiGroup({
  name: "catalog",
  canonical: "eds_catalog",
  description: "Read the principals and resources a decision is made against.",
});

export const opsGroup = apiGroup({
  name: "ops",
  canonical: "eds_ops",
  description: "Demo operations: reset and seed the sample data.",
});
