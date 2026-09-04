import { useMemo, useState } from "react";
import { Loader2, GitBranch, CheckCircle2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, ApiError, type Session, type Policy, type NewPolicyBody, type Action } from "@/lib/api";
import { titleCase, statusVariant } from "@/lib/labels";
import { ROLES, ACTIONS, TIERS, OUTCOMES } from "../../../xano/schema-enums.js";

export function Policies({
  session,
  policies,
  onChanged,
}: {
  session: Session;
  policies: Policy[];
  onChanged: () => Promise<void> | void;
}) {
  const isAdmin = session.role === "policy_admin";
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<NewPolicyBody | null>(null);
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const m = new Map<string, Policy[]>();
    for (const p of policies) {
      const list = m.get(p.policy_key) ?? [];
      list.push(p);
      m.set(p.policy_key, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.version - b.version);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [policies]);

  async function activate(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await api.activatePolicy(id, session.token);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not activate.");
    } finally {
      setBusyId(null);
    }
  }

  function startDraftFrom(active: Policy) {
    setError(null);
    setDraft({
      policy_key: active.policy_key,
      effect: active.effect,
      action: active.action,
      applies_to_role: active.applies_to_role,
      max_tier: active.max_tier,
      priority: active.priority,
      rationale: active.rationale,
    });
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await api.createPolicyVersion(draft, session.token);
      await onChanged();
      setDraft(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create version.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-semibold">Entitlement policies</h2>
        <p className="text-muted-foreground text-sm">
          Rules live here as versioned data. Exactly one version per key is active. Activating a new version flips
          the next decision, and the audit trail keeps the version that decided each past request.
        </p>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {draft && (
        <Card className="border-primary/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-base">New version of {draft.policy_key}</CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={() => setDraft(null)}>
                <X className="size-4" />
              </Button>
            </div>
            <CardDescription>Created as a draft. Activate it to make it the live rule.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DraftSelect label="Effect" value={draft.effect} options={[...OUTCOMES]} onChange={(v) => setDraft({ ...draft, effect: v as NewPolicyBody["effect"] })} />
            <DraftSelect label="Action" value={draft.action} options={[...ACTIONS]} onChange={(v) => setDraft({ ...draft, action: v as Action })} />
            <DraftSelect label="Applies to role" value={draft.applies_to_role} options={[...ROLES]} onChange={(v) => setDraft({ ...draft, applies_to_role: v as NewPolicyBody["applies_to_role"] })} />
            <DraftSelect label="Max tier" value={draft.max_tier} options={[...TIERS]} onChange={(v) => setDraft({ ...draft, max_tier: v as NewPolicyBody["max_tier"] })} />
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Priority (lower wins)</span>
              <input
                type="number"
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
                className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
              />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Rationale</span>
              <textarea
                rows={2}
                value={draft.rationale}
                onChange={(e) => setDraft({ ...draft, rationale: e.target.value })}
                className="border-input bg-background focus-visible:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              />
            </label>
            <div className="sm:col-span-2">
              <Button onClick={saveDraft} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Create draft version
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {grouped.map(([key, versions]) => {
        const active = versions.find((v) => v.status === "active");
        return (
          <Card key={key}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="font-mono text-base">{key}</CardTitle>
                {isAdmin && active && (
                  <Button variant="outline" size="sm" onClick={() => startDraftFrom(active)}>
                    <GitBranch className="size-4" /> New version
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
                    v.status === "active" ? "border-primary/40 bg-accent/30" : "border-border"
                  }`}
                >
                  <span className="font-mono text-sm font-semibold">v{v.version}</span>
                  <Badge variant={statusVariant(v.status)}>{titleCase(v.status)}</Badge>
                  <Badge variant={v.effect === "allow" ? "success" : "destructive"}>{titleCase(v.effect)}</Badge>
                  <span className="text-muted-foreground text-xs">
                    {titleCase(v.applies_to_role)} · {titleCase(v.action)} · up to {titleCase(v.max_tier)}
                    {v.sod_conflict_role ? ` · not with ${titleCase(v.sod_conflict_role)}` : ""} · priority {v.priority}
                  </span>
                  <span className="text-muted-foreground flex-1 basis-full text-xs sm:basis-auto">{v.rationale}</span>
                  {isAdmin && v.status !== "active" && v.status !== "retired" && (
                    <Button variant="secondary" size="sm" onClick={() => activate(v.id)} disabled={busyId === v.id}>
                      {busyId === v.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Activate
                    </Button>
                  )}
                  {isAdmin && v.status === "retired" && (
                    <Button variant="ghost" size="sm" onClick={() => activate(v.id)} disabled={busyId === v.id}>
                      {busyId === v.id ? <Loader2 className="size-4 animate-spin" /> : "Re-activate"}
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {!isAdmin && (
        <p className="text-muted-foreground text-sm">
          Sign in as the policy_admin to create and activate versions. A service_caller or viewer is refused with a
          403.
        </p>
      )}
    </div>
  );
}

function DraftSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {titleCase(o)}
          </option>
        ))}
      </select>
    </label>
  );
}
