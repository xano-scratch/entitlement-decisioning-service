import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Play, Loader2, ShieldCheck, ShieldX, Check, Ban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  api,
  ApiError,
  type Session,
  type Principal,
  type Resource,
  type Policy,
  type CheckResult,
  type Action,
} from "@/lib/api";
import { titleCase, ruleLabel, decisionVariant } from "@/lib/labels";

const ACTIONS: Action[] = ["view", "trade", "withdraw", "export"];

type Preset = {
  label: string;
  action: Action;
  principal: (p: Principal) => boolean;
  resource: (r: Resource) => boolean;
};

// Presets resolve against the seeded catalog by attribute, so they do not
// depend on row ids. Each maps to one rule in the waterfall.
const PRESETS: Preset[] = [
  { label: "Advisor views a retail account", action: "view", principal: (p) => p.subject_role === "advisor" && p.active && !p.secondary_role, resource: (r) => r.resource_type === "account" && r.account_tier === "retail" },
  { label: "Ops withdraws an institutional account", action: "withdraw", principal: (p) => p.subject_role === "ops" && p.active, resource: (r) => r.resource_type === "account" && r.account_tier === "institutional" },
  { label: "Trader who also holds compliance trades", action: "trade", principal: (p) => p.secondary_role === "compliance", resource: (r) => r.resource_type === "account" },
  { label: "Ops tries to trade", action: "trade", principal: (p) => p.subject_role === "ops" && p.active, resource: (r) => r.resource_type === "account" },
  { label: "Inactive principal views", action: "view", principal: (p) => !p.active, resource: (r) => r.resource_type === "account" && r.account_tier === "retail" },
];

export function Console({
  session,
  principals,
  resources,
  policies,
  demo,
  onChecked,
}: {
  session: Session;
  principals: Principal[];
  resources: Resource[];
  policies: Policy[];
  demo: boolean;
  onChecked: () => void;
}) {
  const [principalId, setPrincipalId] = useState<number | "">("");
  const [resourceId, setResourceId] = useState<number | "">("");
  const [action, setAction] = useState<Action>("view");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ranDemo = useRef(false);

  const policyById = useMemo(() => {
    const m = new Map<number, Policy>();
    for (const p of policies) m.set(p.id, p);
    return m;
  }, [policies]);

  async function run(pid: number, rid: number, act: Action) {
    setBusy(true);
    setDenied(null);
    setResult(null);
    try {
      const res = await api.checkAccess({ principal_id: pid, resource_id: rid, action: act }, session.token);
      setResult(res);
      onChecked();
    } catch (err) {
      if (err instanceof ApiError) setDenied(err.message);
      else setDenied("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function applyPreset(preset: Preset) {
    const p = principals.find(preset.principal);
    const r = resources.find(preset.resource);
    if (!p || !r) return;
    setPrincipalId(p.id);
    setResourceId(r.id);
    setAction(preset.action);
    void run(p.id, r.id, preset.action);
  }

  // In demo mode, auto-run the tier-ceiling scenario once the catalog is ready.
  useEffect(() => {
    if (!demo || ranDemo.current) return;
    if (!principals.length || !resources.length) return;
    ranDemo.current = true;
    applyPreset(PRESETS[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, principals, resources]);

  const decidingPolicy = result && result.deciding_policy_id ? policyById.get(result.deciding_policy_id) : undefined;
  const canCheck = session.role === "policy_admin" || session.role === "service_caller";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Check access</CardTitle>
          <CardDescription>
            Ask the engine one question. It answers allow or deny and names the policy version that decided it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Principal">
            <Select value={principalId} onChange={(v) => setPrincipalId(v === "" ? "" : Number(v))}>
              <option value="">Select a principal</option>
              {principals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — {titleCase(p.subject_role)}
                  {p.secondary_role ? ` + ${titleCase(p.secondary_role)}` : ""}
                  {p.active ? "" : " (inactive)"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Resource">
            <Select value={resourceId} onChange={(v) => setResourceId(v === "" ? "" : Number(v))}>
              <option value="">Select a resource</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} — {titleCase(r.resource_type)} / {titleCase(r.account_tier)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Action">
            <Select value={action} onChange={(v) => setAction(v as Action)}>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {titleCase(a)}
                </option>
              ))}
            </Select>
          </Field>

          <Button
            disabled={busy || principalId === "" || resourceId === ""}
            onClick={() => run(Number(principalId), Number(resourceId), action)}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Check access
          </Button>
          {!canCheck && (
            <p className="text-muted-foreground text-xs">
              You are signed in as a viewer. The engine will refuse the check with a 403, which is the point:
              RBAC is enforced at the API layer.
            </p>
          )}

          <div className="border-t pt-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Scenarios</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button key={preset.label} variant="outline" size="sm" onClick={() => applyPreset(preset)} disabled={busy}>
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        {denied ? (
          <ResultShell tone="deny">
            <div className="flex items-center gap-2">
              <Ban className="size-5" />
              <span className="text-lg font-semibold">Refused</span>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">{denied}</p>
          </ResultShell>
        ) : result ? (
          <ResultShell tone={result.decision === "allow" ? "allow" : "deny"}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {result.decision === "allow" ? <ShieldCheck className="size-6" /> : <ShieldX className="size-6" />}
                <Badge variant={decisionVariant(result.decision)} className="px-3 py-1 text-sm uppercase">
                  {result.decision}
                </Badge>
              </div>
              <Badge variant="secondary">{ruleLabel(result.rule)}</Badge>
            </div>

            <p className="mt-4 text-sm leading-relaxed">{result.reason}</p>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label="Principal">
                {result.principal.full_name}
                <div className="text-muted-foreground text-xs">
                  {titleCase(result.principal.subject_role)}
                  {result.principal.secondary_role ? ` + ${titleCase(result.principal.secondary_role)}` : ""}
                </div>
              </Detail>
              <Detail label="Resource">
                {result.resource.label}
                <div className="text-muted-foreground text-xs">
                  {titleCase(result.resource.resource_type)} / {titleCase(result.resource.account_tier)} tier
                </div>
              </Detail>
              <Detail label="Action">{titleCase(result.action)}</Detail>
              <Detail label="Deciding policy">
                {decidingPolicy ? (
                  <span className="font-mono">
                    {decidingPolicy.policy_key} v{result.policy_version}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Baseline grant (no policy)</span>
                )}
              </Detail>
            </dl>

            <p className="text-muted-foreground mt-5 flex items-center gap-1.5 border-t pt-3 text-xs">
              <Check className="size-3" /> Audit row #{result.decision_id} written to the trail.
            </p>
          </ResultShell>
        ) : (
          <ResultShell tone="idle">
            <p className="text-muted-foreground text-sm">
              Pick a principal, resource, and action, or try a scenario. The decision and the rule that fired show up
              here.
            </p>
          </ResultShell>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string | number;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
    >
      {children}
    </select>
  );
}

function ResultShell({ tone, children }: { tone: "allow" | "deny" | "idle"; children: ReactNode }) {
  const ring =
    tone === "allow" ? "border-success/50" : tone === "deny" ? "border-destructive/50" : "border-border";
  return (
    <div className={`bg-card rounded-xl border ${ring} p-6 shadow-sm`}>{children}</div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
