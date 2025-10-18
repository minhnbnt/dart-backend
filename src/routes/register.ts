import argon2 from "argon2";

import { type Database } from "better-sqlite3";
import { registerSchema, type RegisterPayload } from "../schemas.ts";

function isUsernameExists(err: any) {
  return err?.code === "SQLITE_CONSTRAINT_UNIQUE";
}

async function registerUser(db: Database, payload: RegisterPayload) {
  const { username, password } = payload;

  const statement = db.prepare(
    "INSERT INTO users (username, password_hash, last_online) VALUES (?, ?, NULL)",
  );

  const hashedPassword = await argon2.hash(password);

  try {
    const info = statement.run(username, hashedPassword);
    return {
      ok: true,
      body: { userID: info.lastInsertRowid },
    };
  } catch (err) {
    if (isUsernameExists(err)) {
      return { ok: false, message: "Username already exists" };
    }

    throw err;
  }
}

export default async function handleRegister(db: Database, payload: object) {
  const parsed = registerSchema.parse(payload);
  return await registerUser(db, parsed);
}
