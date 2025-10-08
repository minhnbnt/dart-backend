import { type Database } from "better-sqlite3";
import * as z from "zod";

import { isCredentialOK } from "../service/auth.ts";
import { loginSchema } from "../schemas.ts";

async function handleLogin(db: Database, payload: object) {
  try {
    const { username, password } = loginSchema.parse(payload);

    const isOK = await isCredentialOK(db, username, password);
    if (!isOK) {
      return {
        ok: false,
        message: "Username or password does not match.",
      };
    }

    let token = `${username}:${password}`;
    token = Buffer.from(token, "utf8").toString("base64");

    return { ok: true, body: { token } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        message: `Validation error: ${error.message}`,
      };
    }

    throw error;
  }
}

export default handleLogin;
