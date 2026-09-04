import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  api,
  type Session,
  type Decision,
  type Principal,
  type Resource,
  type Policy,
  type DecisionDetail,
} from "@/lib/api";
import { titleCase, ruleLabel, decisionVariant, formatTime } from "@/lib/labels";

export function Audit({
  session,
  decisions,
  principals,
  resources,
  policies,
}: {
  session: Session;
  decisions: Decision[];
  principals: Principal[];
  resources: Resource[];
  policies: Policy[];
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, DecisionDetail>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const principalName = useMemo(() => idMap(principals, (p) => p.full_name), [principals]);
  const resourceName = useMemo(() => idMap(resources, (r) => r.label), [resources]);
  const policyKey = useMemo(() => idMap(policies, (p) => p.policy_key), [policies]);

  async function toggle(id: number) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!detail[id]) {
      setLoadingId(id);
      try {
        const d = await api.getDecision(id, session.token);
        setDetail((prev) => ({ ...prev, [id]: d }));
      } finally {
        setLoadingId(null);
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit trail</CardTitle>
        <CardDescription>
          Every decision, newest first. Each row keeps the exact policy version that decided it. Click a row to see
          the deciding policy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {decisions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No decisions yet. Run a check on the console.</p>
        ) : (
          <div className="divide-border divide-y">
            {decisions.map((d) => {
              const open = openId === d.id;
              const dp = detail[d.id]?.deciding_policy;
              return (
                <div key={d.id}>
                  <button
                    onClick={() => toggle(d.id)}
                    className="hover:bg-accent/30 flex w-full items-center gap-3 py-3 text-left text-sm"
                  >
                    {open ? (
                      <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                    ) : (
                      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <Badge variant={decisionVariant(d.decision)} className="w-14 justify-center uppercase">
                      {d.decision}
                    </Badge>
                    <span className="w-40 shrink-0 truncate font-medium">{principalName.get(d.principal_id) ?? `#${d.principal_id}`}</span>
                    <span className="text-muted-foreground w-28 shrink-0 truncate">{titleCase(d.action)}</span>
                    <span className="text-muted-foreground hidden flex-1 truncate sm:block">
                      {resourceName.get(d.resource_id) ?? `#${d.resource_id}`}
                    </span>
                    <Badge variant="secondary" className="hidden md:inline-flex">
                      {ruleLabel(d.rule)}
                    </Badge>
                    <span className="text-muted-foreground w-28 shrink-0 text-right font-mono text-xs">
                      {d.deciding_policy_id ? `${policyKey.get(d.deciding_policy_id) ?? "policy"} v${d.policy_version}` : "baseline"}
                    </span>
                    <span className="text-muted-foreground hidden w-24 shrink-0 text-right text-xs lg:block">
                      {formatTime(d.created_at)}
                    </span>
                  </button>
                  {open && (
                    <div className="text-muted-foreground bg-muted/30 mb-3 rounded-md p-3 text-sm">
                      <p>{d.reason}</p>
                      {loadingId === d.id && <Loader2 className="mt-2 size-4 animate-spin" />}
                      {dp && (
                        <p className="mt-2">
                          Deciding policy <span className="text-foreground font-mono">{dp.policy_key} v{dp.version}</span>{" "}
                          ({titleCase(dp.status)}, {titleCase(dp.effect)}): {dp.rationale}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function idMap<T extends { id: number }>(rows: T[], pick: (r: T) => string): Map<number, string> {
  const m = new Map<number, string>();
  for (const r of rows) m.set(r.id, pick(r));
  return m;
}
