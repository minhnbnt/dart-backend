import { type Database } from "better-sqlite3";
import { getSocketFromUsername } from "./socketMap.ts";

type Invitation = {
  id: number;
  status: string;
  toUsername: string;
  fromUsername: string;
};

function insertChallenge(db: Database, from: string, to: string) {
  const query = `
    INSERT INTO invitation (from_id, to_id, status)
    SELECT u1.id, u2.id, 'pending'
    FROM users AS u1
    JOIN users AS u2
      ON u1.username = ?
     AND u2.username = ?;
  `;

  const result = db.prepare(query).run(from, to);
  return result.lastInsertRowid;
}

function checkCanAnswer(db: Database, username: string, challengeId: number) {
  const query = `
    SELECT
	  i.status,
	  to_user.username AS toUsername,
	  from_user AS fromUsername
    FROM invitation AS i
    JOIN users AS to_user ON i.to_id = to_user.id
    JOIN users AS to_user ON i.from_id = to_user.id
    WHERE i.id = ?;
  `;

  const result = db.prepare(query).get(challengeId) as Invitation | null;
  if (!result) {
    throw Error("Challenge not found.");
  }

  const { status, toUsername } = result;
  if (status !== "pending") {
    throw Error("The challenge was answered.");
  }

  if (toUsername != username) {
    throw Error("You are not the receiver of the challenge.");
  }

  return result;
}

type AnswerStatus = "accepted" | "declined";

function onChallengeAccepted(invitation: Omit<Invitation, "status">) {
  const { id, fromUsername } = invitation;

  const fromSocket = getSocketFromUsername(fromUsername);
  if (fromSocket === undefined) {
    throw new Error("Replies can't be sent.");
  }

  // TODO: create new game

  fromSocket.write(JSON.stringify({ event: "startGame", body: { id } }));

  fromSocket.write("\n");
}

function updateChallenge(
  db: Database,
  invitationId: number,
  newStatus: AnswerStatus,
) {
  let statement = db.prepare("UPDATE invitation SET status = ? WHERE id = ?");
  let result = statement.run(newStatus, invitationId);

  if (result.changes === 0) {
    throw new Error("Cannot update challenge status.");
  }
}

export {
  insertChallenge,
  checkCanAnswer,
  updateChallenge,
  onChallengeAccepted,
};
