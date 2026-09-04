// Small presentation helpers — turn stored enum values into readable text and
// pick a badge variant for a decision, rule, or policy status.

export function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const RULE_TEXT: Record<string, string> = {
  inactive: "Principal inactive",
  no_grant: "No baseline grant",
  explicit_deny: "Explicit deny policy",
  tier_ceiling: "Tier ceiling",
  sod_conflict: "Segregation of duties",
  baseline_allow: "Baseline grant",
  policy_allow: "Policy allow",
};

export function ruleLabel(rule: string | null | undefined): string {
  if (!rule) return "";
  return RULE_TEXT[rule] ?? titleCase(rule);
}

export type BadgeVariant = "default" | "secondary" | "success" | "destructive" | "outline" | "muted";

export function decisionVariant(decision: string | null | undefined): BadgeVariant {
  return decision === "allow" ? "success" : "destructive";
}

export function statusVariant(status: string | null | undefined): BadgeVariant {
  if (status === "active") return "default";
  if (status === "draft") return "secondary";
  return "muted";
}

export function formatTime(epochMs: number | null | undefined): string {
  if (!epochMs) return "";
  const d = new Date(epochMs);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
