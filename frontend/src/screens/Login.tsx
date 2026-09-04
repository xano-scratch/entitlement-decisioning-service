import { useState } from "react";
import { ShieldCheck, LogIn, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, ApiError, type Session } from "@/lib/api";
import { titleCase } from "@/lib/labels";

const DEMO_ACCOUNTS = [
  { role: "policy_admin", email: "admin@wealthfirm.example", password: "admin-demo-pass", blurb: "Curates policies: create and activate versions." },
  { role: "service_caller", email: "service@wealthfirm.example", password: "service-demo-pass", blurb: "Calls the engine: may check access, not edit policy." },
  { role: "viewer", email: "viewer@wealthfirm.example", password: "viewer-demo-pass", blurb: "Read only: sees policies and the audit trail." },
] as const;

export function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: string, p: string, tag: string) {
    setBusy(tag);
    setError(null);
    try {
      onLogin(await api.login({ email: e, password: p }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entitlement Decisioning Service</h1>
          <p className="text-muted-foreground text-sm">
            One governed API answers "can this role take this action on this account?"
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign in as a service account</CardTitle>
          <CardDescription>
            Pick a role to see how RBAC gates the API. These are throwaway demo accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {DEMO_ACCOUNTS.map((acct) => (
            <button
              key={acct.role}
              onClick={() => signIn(acct.email, acct.password, acct.role)}
              disabled={busy !== null}
              className="hover:border-ring hover:bg-accent/40 flex items-center justify-between gap-4 rounded-lg border p-4 text-left transition-colors disabled:opacity-60"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{titleCase(acct.role)}</Badge>
                  <span className="text-muted-foreground truncate font-mono text-xs">{acct.email}</span>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{acct.blurb}</p>
              </div>
              {busy === acct.role ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : (
                <LogIn className="text-muted-foreground size-4 shrink-0" />
              )}
            </button>
          ))}

          <div className="text-muted-foreground pt-2 text-center text-xs">or sign in manually</div>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(ev) => {
              ev.preventDefault();
              void signIn(email, password, "manual");
            }}
          >
            <input
              type="email"
              required
              placeholder="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="border-input bg-background focus-visible:ring-ring h-9 flex-1 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
            />
            <input
              type="password"
              required
              placeholder="password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="border-input bg-background focus-visible:ring-ring h-9 flex-1 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
            />
            <Button type="submit" disabled={busy !== null}>
              {busy === "manual" ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
