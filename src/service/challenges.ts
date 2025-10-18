import { type Database } from "better-sqlite3";

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

type AnswerStatus = "accepted" | "declined";

function updateChallenge(db: Database, id: number, newStatus: AnswerStatus) {
  const statement = db.prepare("UPDATE invitation SET status = ? WHERE id = ?");
  const result = statement.run(newStatus, id);

  if (result.changes === 0) {
    throw new Error("Cannot update challenge status.");
  }
}

export { insertChallenge, checkCanAnswer, updateChallenge };
