import argon2 from "argon2";
import * as z from "zod";

import { type Database } from "better-sqlite3";

const registerSchema = z.object({
  username: z.string().min(8),
  password: z.string().min(8),
});

type RegisterPayload = z.infer<typeof registerSchema>;

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
    if ((err as any)?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return { ok: false, message: "Username already exists" };
    }
    throw err;
  }
}

async function handleRegister(db: Database, payload: object) {
  try {
    const parsed = registerSchema.parse(payload);
    return await registerUser(db, parsed);
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

export default handleRegister;
