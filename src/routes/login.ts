import argon2 from "argon2";
import { type Database } from "better-sqlite3";
import * as z from "zod";

const loginSchema = z.object({
  username: z.string().min(8),
  password: z.string().min(8),
});

type LoginPayload = z.infer<typeof loginSchema>;
type UserRow = {
  id: number;
  password_hash: string;
};

async function checkCredential(db: Database, payload: LoginPayload) {
  const { username, password } = payload;

  const statement = db.prepare(
    "SELECT id, password_hash FROM users WHERE username = ?",
  );
  const user = statement.get(username) as UserRow;
  if (!user) {
    return {
      ok: false,
      message: "Username or password does not match.",
    };
  }

  const isPasswordMatch = await argon2.verify(user.password_hash, password);
  if (!isPasswordMatch) {
    return {
      ok: false,
      message: "Username or password does not match.",
    };
  }

  return {
    ok: true,
    body: { userID: user.id },
  };
}

async function handleLogin(db: Database, payload: object) {
  try {
    const parsed = loginSchema.parse(payload);
    return await checkCredential(db, parsed);
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      throw error;
    }

    return {
      ok: false,
      message: `Validation error: ${error.message}`,
    };
  }
}

export default handleLogin;
