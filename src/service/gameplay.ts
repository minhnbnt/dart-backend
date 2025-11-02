import { type Database } from 'better-sqlite3';
import { throwRequestSchema, type ThrowRequest } from '../schemas.ts';
import { getSocketFromUsername } from './socketMap.ts';

function writeAttempt(db: Database, username: string, body: ThrowRequest) {
	const { matchId, score } = body;

	const query = `
		SELECT
			u.id AS playerId,
			COALESCE(MAX(ta.attempt_number), 0) + 1 AS nextAttempt
		FROM throw_attempt ta
		JOIN users u ON ta.player_id = u.id
		WHERE ta.match_id = ? AND u.username = ?;
	`;

	const result = db.prepare(query).get(matchId, username) as any;

	const playerId = result?.playerId;
	if (!playerId) {
		throw new Error(`Player ${username} not found`);
	}

	const nextAttempt = result?.nextAttempt ?? 1;
	if (nextAttempt > 3) {
		throw new Error('Player has already used all 3 attempts');
	}

	const insertQuery = `
		INSERT INTO throw_attempt (match_id, player_id, attempt_number, score)
		VALUES (?, ?, ?, ?)
	`;

	db.prepare(insertQuery).run(matchId, playerId, nextAttempt, score);
}

function sendToOther(db: Database, fromUsername: string, body: ThrowRequest) {
	const { score, matchId } = body;

	const otherPlayerQuery = `
		SELECT users.username AS otherUsername FROM users
		WHERE users.username != ? AND id IN (
			SELECT from_id FROM invitation WHERE id = ?
			UNION
			SELECT to_id FROM invitation WHERE id = ?
		)
		LIMIT 1;
	`;

	const otherPlayerResult = db
		.prepare(otherPlayerQuery)
		.get(fromUsername, matchId, matchId);

	if (!otherPlayerResult) {
		throw new Error('Other player does not found.');
	}

	const { otherUsername } = otherPlayerResult as any;
	const otherPlayerSocket = getSocketFromUsername(otherUsername);

	if (!otherPlayerSocket) {
		throw new Error("Other player's socket does not found.");
	}

	otherPlayerSocket.write(
		JSON.stringify({ event: 'otherThrew', body: { score } }),
	);

	otherPlayerSocket.write('\n');
}

export function throwDart(db: Database, username: string, body: object) {
	const parsedBody = throwRequestSchema.parse(body);
	writeAttempt(db, username, parsedBody);
	sendToOther(db, username, parsedBody);
}
