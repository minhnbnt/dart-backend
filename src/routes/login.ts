import { type Database } from "better-sqlite3";

import { isCredentialOK } from "../service/auth.ts";
import { loginSchema } from "../schemas.ts";
import { isUserOnline } from "../service/socketMap.ts";

async function handleLogin(db: Database, payload: object) {
  const { username, password } = loginSchema.parse(payload);

  if (isUserOnline(username)) {
    return {
      ok: false,
      message: "Please logout of other session to continue.",
    };
  }

  const isOK = await isCredentialOK(db, username, password);
  if (!isOK) {
    return {
      ok: false,
      message: "Username or password does not match.",
    };
  }

  let token = `${username}:${password}`;
  token = Buffer.from(token, "utf8").toString("base64");

  return {
    ok: true,
    body: { username, token },
  };
}

export default handleLogin;
