// The one contract: every path and every request/response type is derived from
// the xanots query defs. Change a def and this file follows — no hand-typed URL
// or request body. Types are imported type-only (they erase to nothing); the
// lean query defs are imported as values for getPath()/verb.
//
// The one exception is ops/seed: its stack builds many rows, so importing it
// would drag that whole stack into the browser bundle. It is declared as plain
// ROUTES metadata instead (verified against `npx xanots routes xano/index.ts`).

import type { InferInput, InferResponse } from "@xanots/sdk";

import { loginQuery } from "../../../xano/api/auth-login.js";
import { checkAccessQuery } from "../../../xano/api/check-access.js";
import { decisionsListQuery } from "../../../xano/api/decisions-list.js";
import { decisionGetQuery } from "../../../xano/api/decisions-get.js";
import { policiesListQuery } from "../../../xano/api/policies-list.js";
import { policiesVersionQuery } from "../../../xano/api/policies-version.js";
import { policiesActivateQuery } from "../../../xano/api/policies-activate.js";
import { catalogPrincipalsQuery } from "../../../xano/api/catalog-principals.js";
import { catalogResourcesQuery } from "../../../xano/api/catalog-resources.js";

/** The stack-heavy escape hatch — plain metadata, no def import. */
export const ROUTES = {
  seed: { path: "/api:eds_ops/seed", verb: "POST" },
} as const;

/**
 * The deployed Xano backend base URL, injected as `window.XANO_HOST` by
 * `xanots deploy --static`, or `VITE_XANO_HOST` in dev.
 */
export const XANO_HOST: string =
  (typeof window !== "undefined" && (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

// ---- derived types ----
export type LoginBody = InferInput<typeof loginQuery>;
export type Session = InferResponse<typeof loginQuery>;
export type Role = Session["role"];

export type CheckAccessBody = InferInput<typeof checkAccessQuery>;
export type CheckResult = InferResponse<typeof checkAccessQuery>;
export type Action = CheckAccessBody["action"];

export type Decision = InferResponse<typeof decisionsListQuery>[number];
export type DecisionDetail = InferResponse<typeof decisionGetQuery>;

export type Policy = InferResponse<typeof policiesListQuery>[number];
export type NewPolicyBody = InferInput<typeof policiesVersionQuery>;

export type Principal = InferResponse<typeof catalogPrincipalsQuery>[number];
export type Resource = InferResponse<typeof catalogResourcesQuery>[number];

// ---- fetch helpers ----
class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, verb: string, token?: string | null, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(XANO_HOST + path, {
    method: verb,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.message ?? text;
    } catch {
      /* keep raw text */
    }
    throw new ApiError(res.status, message || `Request failed (${res.status}).`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export { ApiError };

export const api = {
  login: (body: LoginBody) => call<Session>(loginQuery.getPath(), loginQuery.verb, null, body),

  checkAccess: (body: CheckAccessBody, token: string) =>
    call<CheckResult>(checkAccessQuery.getPath(), checkAccessQuery.verb, token, body),

  listDecisions: (token: string) =>
    call<Decision[]>(decisionsListQuery.getPath(), decisionsListQuery.verb, token),

  getDecision: (id: number, token: string) =>
    call<DecisionDetail>(decisionGetQuery.getPath({ params: { id: String(id) } }), decisionGetQuery.verb, token),

  listPolicies: (token: string) =>
    call<Policy[]>(policiesListQuery.getPath(), policiesListQuery.verb, token),

  createPolicyVersion: (body: NewPolicyBody, token: string) =>
    call<Policy>(policiesVersionQuery.getPath(), policiesVersionQuery.verb, token, body),

  activatePolicy: (id: number, token: string) =>
    call<Policy>(policiesActivateQuery.getPath({ params: { id: String(id) } }), policiesActivateQuery.verb, token),

  listPrincipals: (token: string) =>
    call<Principal[]>(catalogPrincipalsQuery.getPath(), catalogPrincipalsQuery.verb, token),

  listResources: (token: string) =>
    call<Resource[]>(catalogResourcesQuery.getPath(), catalogResourcesQuery.verb, token),

  resetDemo: () => call<{ ok: boolean }>(ROUTES.seed.path, ROUTES.seed.verb),
};
