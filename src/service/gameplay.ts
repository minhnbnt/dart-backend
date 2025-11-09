import { type Database } from 'better-sqlite3';
import { type ThrowRequest } from '../schemas.ts';
import { getSocketFromUsername } from './socketMap.ts';

function writeAttempt(db: Database, username: string, body: ThrowRequest) {
	const { matchId, score } = body;

	const query = `
		SELECT
			u.id AS playerId,
			COALESCE(MAX(ta.attempt_number), 0) + 1 AS nextAttempt
		FROM users u
		LEFT JOIN throw_attempt ta ON ta.player_id = u.id AND ta.match_id = ?
		WHERE u.username = ?
		GROUP BY u.id;
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

export function onPlayerThrow(
	db: Database,
	username: string,
	body: ThrowRequest,
) {
	writeAttempt(db, username, body);
	sendToOther(db, username, body);

	return { ok: true };
}

type PlayingMatch = {
	matchId: number;
	fromUsername: string;
	toUserName: string;
};

export function getPlayingMatch(db: Database, username: string) {
	const query = `
		SELECT
			m.invitation_id AS matchId,
			u1.username AS fromUsername,
			u2.username AS toUserName
		FROM match m
		JOIN invitation i ON m.invitation_id = i.id
		JOIN users u1 ON i.from_id = u1.id
		JOIN users u2 ON i.to_id = u2.id
		WHERE (i.from_id IN (SELECT id FROM users WHERE username = ?)
		    OR i.to_id IN (SELECT id FROM users WHERE username = ?))
		  AND m.forfeited_by IS NULL
		  AND EXISTS (
			  SELECT 1
			  FROM throw_attempt t
			  WHERE t.match_id = m.invitation_id
			    AND t.player_id IN (SELECT id FROM users WHERE username = ?)
			  GROUP BY t.player_id
			  HAVING COUNT(t.attempt_number) < 3
		  );
	`;

	const result = db.prepare(query).get(username, username, username);
	if (!result) {
		return undefined;
	}

	return result as PlayingMatch;
}

export function isPlayerInMatch(db: Database, username: string) {
	return getPlayingMatch(db, username) !== undefined;
}

export function onPlayerForfeited(
	db: Database,
	username: string,
	match: PlayingMatch,
) {
	const { matchId, fromUsername, toUserName } = match;

	const query = `
		UPDATE match
		SET forfeited_by = (SELECT id FROM users WHERE username = ?)
		WHERE invitation_id = ?;
	`;

	db.prepare(query).run(username, matchId);

	const otherUsername = username === fromUsername ? toUserName : fromUsername;

	const otherPlayerSocket = getSocketFromUsername(otherUsername);
	if (otherPlayerSocket) {
		otherPlayerSocket.write(
			JSON.stringify({ event: 'playerForfeited', body: { matchId, username } }),
		);

		otherPlayerSocket.write('\n');
	}
}
