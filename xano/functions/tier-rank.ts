import { defineFunction, input, s, c, expr, inp, ref } from "@xanots/sdk";
import { TIERS } from "../schema-enums.js";

/**
 * tier_rank — maps an account tier to a comparable integer so the ceiling check
 * in check-access is one numeric comparison. Centralizing it here means the
 * ordering of tiers (retail < hnw < institutional) lives in ONE place instead of
 * being re-encoded at every call site.
 */
export const tierRankFn = defineFunction({
  name: "tier_rank",
  input: { tier: input.enum([...TIERS], { required: true }) },
  stack: [
    s.conditional({
      when: expr(inp("tier"), "=", c.text("institutional")),
      then: [s.set_var("rank", c.int(3))],
      elif: [{ when: expr(inp("tier"), "=", c.text("hnw")), then: [s.set_var("rank", c.int(2))] }],
      else: [s.set_var("rank", c.int(1))],
    }),
  ],
  response: { rank: ref("rank") },
});
