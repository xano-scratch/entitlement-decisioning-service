import { query, input, s, c, expr, inp, ref } from "@xanots/sdk";
import { authGroup } from "./groups.js";
import { serviceAccounts } from "../tables.js";

/**
 * POST api:eds_auth/login — verify a service account and mint a bearer token.
 *
 * The password is taken as `input.text` (NOT `input.password`): an
 * `f.password` column already hashes on write, and `input.password` would hash
 * the submission again, so `check_password` would compare two different hashes
 * and always fail. The `output` naming `password` is required because the
 * column is internal and absent from a plain read.
 */
export const loginQuery = query({
  name: "login",
  verb: "POST",
  apiGroup: authGroup,
  auth: false,
  input: {
    email: input.text({ required: true }),
    password: input.text({ required: true }),
  },
  stack: [
    s.db.get({
      table: serviceAccounts,
      fieldName: "email",
      fieldValue: inp("email"),
      output: ["id", "email", "display_name", "role", "password"],
      as: "u",
    }),
    s.precondition({
      expr: expr(ref("u", { safe: true }), "!=", c.null()),
      error_type: "unauthorized",
      error: c.text("No account with that email."),
    }),
    s.security.check_password({
      text_password: inp("password"),
      hash_password: ref("u.password"),
      as: "ok",
    }),
    s.precondition({
      expr: expr(ref("ok"), "=", c.bool(true)),
      error_type: "unauthorized",
      error: c.text("That email and password do not match."),
    }),
    s.security.create_auth_token({
      table: serviceAccounts,
      id: ref("u.id"),
      as: "token",
    }),
  ],
  response: {
    token: ref("token"),
    id: ref("u.id"),
    email: ref("u.email"),
    display_name: ref("u.display_name"),
    role: ref("u.role"),
  },
});
