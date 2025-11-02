import { type Database } from 'better-sqlite3';
import { throwRequestSchema } from '../schemas.ts';

export function throwDart(db: Database, username: string, body: object) {
	const { matchId, score } = throwRequestSchema.parse(body);

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

	// TODO: send event to other player
}
