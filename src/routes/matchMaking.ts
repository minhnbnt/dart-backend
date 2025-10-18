import { type Database } from "better-sqlite3";

import { challengeAnswerSchema, challengeSchema } from "../schemas.ts";
import { getSocketFromUsername } from "../service/socketMap.ts";

function insertChallenge(db: Database, from: string, to: string) {
  const query = `
    INSERT INTO invitation (from_id, to_id, status)
    SELECT u1.id, u2.id, 'pending'
    FROM users AS u1
    JOIN users AS u2
      ON u1.username = ?1
     AND u2.username = ?2;
  `;

  const result = db.prepare(query).run(from, to);
  return result.lastInsertRowid;
}

function checkCanAnswer(db: Database, username: string, challengeId: number) {
  const query = `
    SELECT i.status, to_user.username AS toUsername
    FROM invitation AS i
    JOIN users AS to_user ON i.to_id = to_user.id
    WHERE i.id = ?;
  `;

  const result = db.prepare(query).get(challengeId);
  if (!result) {
    throw Error("Challenge not found");
  }

  type QueryResponse = {
    id: number;
    status: string;
    toUsername: string;
  };

  const { status, toUsername } = result as QueryResponse;
  if (status !== "pending") {
    throw Error("The challenge was answered.");
  }

  if (toUsername != username) {
    throw Error("You are not the receiver of the challenge.");
  }
}

function updateChallenge(
  db: Database,
  id: number,
  newStatus: "accepted" | "declined",
) {
  const statement = db.prepare("UPDATE invitation SET status = ? WHERE id = ?");
  const result = statement.run(newStatus, id);

  if (result.changes === 0) {
    throw new Error("Cannot update challenge status.");
  }
}

export function answerChallenge(db: Database, username: string, body: object) {
  const { challengeId, newStatus } = challengeAnswerSchema.parse(body);

  try {
    checkCanAnswer(db, username, challengeId);
    updateChallenge(db, challengeId, newStatus);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.toLowerCase().includes("challenge")
    ) {
      return {
        ok: false,
        message: err.message,
      };
    }

    throw err;
  }
}

export function sendChallenge(db: Database, from: string, message: object) {
  const { to } = challengeSchema.parse(message);

  const isSelfChallenge = from === to;
  if (isSelfChallenge) {
    return {
      ok: false,
      body: { message: "You can't send a challenge to yourself." },
    };
  }

  const toSocket = getSocketFromUsername(to);

  const isOnline = toSocket !== undefined;
  if (!isOnline) {
    return {
      ok: false,
      body: { message: `"${to}" is not online right now.` },
    };
  }

  const newChallengeId = insertChallenge(db, from, to);

  toSocket.write(
    JSON.stringify({
      event: "newChallenger",
      body: { from, challengeId: newChallengeId },
    }) + "\n",
  );

  return {
    ok: true,
    body: { message: `Sent the challenge to "${to}".` },
  };
}
