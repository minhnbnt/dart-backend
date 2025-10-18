import argon2 from "argon2";
import { type Database } from "better-sqlite3";

type UserRow = {
  id: number;
  password_hash: string;
};

async function updateLastOnline(db: Database, username: string) {
  const statement = db.prepare(
    "UPDATE users SET last_online = CURRENT_TIMESTAMP WHERE username = ?",
  );

  statement.run(username);
}

export async function isCredentialOK(
  db: Database,
  username: string,
  password: string,
) {
  const statement = db.prepare(
    "SELECT id, password_hash FROM users WHERE username = ?",
  );

  const user = statement.get(username) as UserRow;
  if (!user) {
    return false;
  }

  const isPasswordMatch = await argon2.verify(user.password_hash, password);
  return isPasswordMatch;
}

async function getBasicTokenIssuer(db: Database, tokenValue: string) {
  const decoded = Buffer.from(tokenValue!, "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }

  const username = decoded.substring(0, separatorIndex);
  const password = decoded.substring(separatorIndex + 1);

  if (await isCredentialOK(db, username, password)) {
    return username;
  } else {
    return null;
  }
}

export async function checkToken(db: Database, token: string) {
  const tokens = token.split(" ");
  if (tokens.length !== 2) {
    return false;
  }

  const [tokenType, tokenValue] = tokens;

  if (tokenType !== "Basic") {
    return false;
  }

  const issuer = await getBasicTokenIssuer(db, tokenValue!);
  if (issuer !== null) {
    updateLastOnline(db, issuer);
    return true;
  } else {
    return false;
  }
}
