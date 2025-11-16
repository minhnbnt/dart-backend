import { type Database } from 'better-sqlite3';
import { type ThrowRequest, type SpinRequest } from '../schemas.ts';
import { getSocketFromUsername } from './socketMap.ts';

function getOtherPlayerSocket(username: string, match: PlayingMatch) {
	const { fromUsername, toUserName } = match;
	const otherUsername = username === fromUsername ? toUserName : fromUsername;
	const otherPlayerSocket = getSocketFromUsername(otherUsername);

	if (!otherPlayerSocket) {
		throw new Error(`Other player's socket does not found.`);
	}

	return otherPlayerSocket;
}

function writeAttempt(
	db: Database,
	username: string,
	{ matchId }: PlayingMatch,
	{ score }: ThrowRequest,
) {
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

function sendToOther(
	username: string,
	match: PlayingMatch,
	body: ThrowRequest,
) {
	const { score, dx, dy, rotationAngle } = body;

	const otherPlayerSocket = getOtherPlayerSocket(username, match);

	otherPlayerSocket.write(
		JSON.stringify({
			event: 'otherThrew',
			body: { score, dx, dy, rotationAngle },
		}),
	);

	otherPlayerSocket.write('\n');
}

export function onPlayerThrow(
	db: Database,
	username: string,
	body: ThrowRequest,
) {
	const match = getPlayingMatch(db, username);
	if (!match) {
		throw new Error(`No active match found for player ${username}`);
	}

	writeAttempt(db, username, match, body);
	sendToOther(username, match, body);

	return { ok: true };
}

export function onPlayerSpin(
	db: Database,
	username: string,
	body: SpinRequest,
) {
	const { rotationAmount, duration } = body;

	const match = getPlayingMatch(db, username);
	if (!match) {
		throw new Error(`No active match found for player ${username}`);
	}

	const otherPlayerSocket = getOtherPlayerSocket(username, match);

	otherPlayerSocket.write(
		JSON.stringify({
			event: 'opponentSpin',
			body: { rotationAmount, duration },
		}),
	);

	otherPlayerSocket.write('\n');

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
	const { matchId } = match;

	const query = `
		UPDATE match
		SET forfeited_by = (SELECT id FROM users WHERE username = ?)
		WHERE invitation_id = ?;
	`;

	db.prepare(query).run(username, matchId);

	try {
		const otherPlayerSocket = getOtherPlayerSocket(username, match);
		otherPlayerSocket.write(
			JSON.stringify({ event: 'playerForfeited', body: { matchId, username } }),
		);

		otherPlayerSocket.write('\n');
	} catch (error) {
		// Other player is offline, that's ok
	}
}
