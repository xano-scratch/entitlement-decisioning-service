import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, RotateCcw, LogOut, Gavel, GitBranch, ScrollText, Loader2 } from "lucide-react";

import { Login } from "./screens/Login.js";
import { Console } from "./screens/Console.js";
import { Policies } from "./screens/Policies.js";
import { Audit } from "./screens/Audit.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  api,
  type Session,
  type Principal,
  type Resource,
  type Policy,
  type Decision,
} from "@/lib/api";
import { loadSession, saveSession, clearSession } from "@/lib/session";
import { titleCase } from "@/lib/labels";

const DEMO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo");

type Tab = "console" | "policies" | "audit";

const TABS: { key: Tab; label: string; icon: typeof Gavel }[] = [
  { key: "console", label: "Access Console", icon: Gavel },
  { key: "policies", label: "Policies", icon: GitBranch },
  { key: "audit", label: "Audit Trail", icon: ScrollText },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [tab, setTab] = useState<Tab>("console");
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const setAndSave = useCallback((s: Session) => {
    saveSession(s);
    setSession(s);
  }, []);

  // Demo deep link: auto-sign-in as the service caller so a screenshot lands on
  // a governed result without a click.
  useEffect(() => {
    if (!DEMO || session) return;
    api
      .login({ email: "service@wealthfirm.example", password: "service-demo-pass" })
      .then(setAndSave)
      .catch(() => {});
  }, [session, setAndSave]);

  const refreshPolicies = useCallback(async () => {
    if (!session) return;
    setPolicies(await api.listPolicies(session.token));
  }, [session]);

  const refreshDecisions = useCallback(async () => {
    if (!session) return;
    setDecisions(await api.listDecisions(session.token));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      api.listPrincipals(session.token),
      api.listResources(session.token),
      api.listPolicies(session.token),
      api.listDecisions(session.token),
    ])
      .then(([p, r, pol, dec]) => {
        if (!alive) return;
        setPrincipals(p);
        setResources(r);
        setPolicies(pol);
        setDecisions(dec);
      })
      .catch(() => {
        // A stale/invalid token: drop it and return to sign-in.
        if (!alive) return;
        clearSession();
        setSession(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  async function resetDemo() {
    if (!session) return;
    setResetting(true);
    try {
      await api.resetDemo();
      const [p, r, pol, dec] = await Promise.all([
        api.listPrincipals(session.token),
        api.listResources(session.token),
        api.listPolicies(session.token),
        api.listDecisions(session.token),
      ]);
      setPrincipals(p);
      setResources(r);
      setPolicies(pol);
      setDecisions(dec);
    } finally {
      setResetting(false);
    }
  }

  function signOut() {
    clearSession();
    setSession(null);
    setPrincipals([]);
    setResources([]);
    setPolicies([]);
    setDecisions([]);
  }

  if (!session) return <Login onLogin={setAndSave} />;

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <ShieldCheck className="size-4" />
          </div>
          <div className="mr-auto">
            <p className="text-sm leading-tight font-semibold">Entitlement Decisioning Service</p>
            <p className="text-muted-foreground text-xs leading-tight">Business logic centralization for wealth management</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{session.display_name}</p>
            <Badge variant="outline" className="mt-0.5">{titleCase(session.role)}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={resetDemo} disabled={resetting}>
            {resetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            Reset demo
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={signOut} title="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent"
                }`}
              >
                <Icon className="size-4" /> {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading the governed data…
          </div>
        ) : tab === "console" ? (
          <Console
            session={session}
            principals={principals}
            resources={resources}
            policies={policies}
            demo={DEMO}
            onChecked={refreshDecisions}
          />
        ) : tab === "policies" ? (
          <Policies session={session} policies={policies} onChanged={refreshPolicies} />
        ) : (
          <Audit
            session={session}
            decisions={decisions}
            principals={principals}
            resources={resources}
            policies={policies}
          />
        )}
      </main>
    </div>
  );
}
