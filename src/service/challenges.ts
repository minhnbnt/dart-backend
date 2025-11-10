import { type Database } from 'better-sqlite3';
import { getSocketFromUsername } from './socketMap.ts';

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
		FROM users AS u1, users AS u2
		WHERE u1.username = ? AND u2.username = ?;
	`;

	const result = db.prepare(query).run(from, to);
	return result.lastInsertRowid;
}

function checkCanAnswer(db: Database, username: string, challengeId: number) {
	const query = `
		SELECT
			i.id,
			i.status,
			to_user.username AS toUsername,
			from_user.username AS fromUsername
		FROM invitation AS i
		JOIN users AS to_user ON i.to_id = to_user.id
		JOIN users AS from_user ON i.from_id = from_user.id
		WHERE i.id = ?;
	`;

	const result = db.prepare(query).get(challengeId) as Invitation | null;
	if (!result) {
		throw Error('Challenge not found.');
	}

	const { status, toUsername } = result;
	console.log(result);
	if (status !== 'pending') {
		throw Error('The challenge was answered.');
	}

	if (toUsername != username) {
		throw Error('You are not the receiver of the challenge.');
	}

	return result;
}

type AnswerStatus = 'accepted' | 'declined';

function onChallengeAccepted(
	db: Database,
	invitation: Omit<Invitation, 'status'>,
) {
	const { id, fromUsername, toUsername } = invitation;

	const fromSocket = getSocketFromUsername(fromUsername);
	const toSocket = getSocketFromUsername(toUsername);

	if (fromSocket === undefined || toSocket === undefined) {
		throw new Error("Replies can't be sent.");
	}

	const startGameMessage =
		JSON.stringify({ event: 'startGame', body: { id } }) + '\n';

	fromSocket.write(startGameMessage);
	toSocket.write(startGameMessage);

	rejectAllChallenge(db, fromUsername);
	rejectAllChallenge(db, toUsername);
}

function updateChallenge(
	db: Database,
	invitationId: number,
	newStatus: AnswerStatus,
) {
	let statement = db.prepare('UPDATE invitation SET status = ? WHERE id = ?');
	let result = statement.run(newStatus, invitationId);

	if (result.changes === 0) {
		throw new Error('Cannot update challenge status.');
	}
}

function rejectAllChallenge(db: Database, username: string) {
	const query = `
		UPDATE invitation
		SET status = 'declined'
		WHERE status = 'pending'
		  AND (
			  from_id = (SELECT id FROM users WHERE username = ?)
			  OR to_id = (SELECT id FROM users WHERE username = ?)
		  )
		RETURNING
			id,
			(SELECT username FROM users WHERE id = from_id) AS fromUsername,
			(SELECT username FROM users WHERE id = to_id) AS toUsername
	`;

	type Challenge = {
		id: number;
		fromUsername: string;
		toUsername: string;
	};

	const affectedChallenges = db
		.prepare(query)
		.all(username, username) as Challenge[];

	affectedChallenges.forEach((challenge) => {
		const { id, fromUsername, toUsername } = challenge;

		const isFrom = username === fromUsername;

		const receiverUsername = isFrom ? toUsername : fromUsername;
		const event = isFrom ? 'challengeCanceled' : 'challengeRejected';

		const socket = getSocketFromUsername(receiverUsername);

		if (socket === undefined) {
			return;
		}

		const message = JSON.stringify({ event, body: { id } });

		socket.write(message);
		socket.write('\n');
	});
}

export {
	checkCanAnswer,
	insertChallenge,
	onChallengeAccepted,
	rejectAllChallenge,
	updateChallenge,
};
