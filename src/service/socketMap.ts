import { Socket } from 'net';
import type { Database } from 'better-sqlite3';

import db from '../configs/database.ts';
import { updateLastOnline } from './auth.ts';
import { getPlayingMatch, onPlayerForfeited } from './gameplay.ts';
import { rejectAllChallenge } from './challenges.ts';

interface PlayerStats {
	username: string;
	totalMatches: number;
	wins: number;
	losses: number;
	totalScore: number;
	winRate: number;
}

function getPlayerStats(database: Database, username: string): PlayerStats {
	// Get user ID
	const user = database
		.prepare('SELECT id FROM users WHERE username = ?')
		.get(username) as { id: number } | undefined;

	if (!user) {
		return {
			username,
			totalMatches: 0,
			wins: 0,
			losses: 0,
			totalScore: 0,
			winRate: 0,
		};
	}

	// Count total matches (both as from_id and to_id)
	const matchCountResult = database
		.prepare(
			`SELECT COUNT(DISTINCT m.invitation_id) as total
			FROM match m
			JOIN invitation i ON m.invitation_id = i.id
			WHERE (i.from_id = ? OR i.to_id = ?)
			AND i.status = 'accepted'`,
		)
		.get(user.id, user.id) as { total: number };

	const totalMatches = matchCountResult.total;

	// Calculate total score from all throw attempts
	const scoreResult = database
		.prepare(
			`SELECT COALESCE(SUM(score), 0) as total
			FROM throw_attempt
			WHERE player_id = ?`,
		)
		.get(user.id) as { total: number };

	const totalScore = scoreResult.total;

	// Calculate wins and losses
	const winsResult = database
		.prepare(
			`SELECT COUNT(*) as wins
			FROM match m
			JOIN invitation i ON m.invitation_id = i.id
			WHERE i.status = 'accepted'
			AND m.forfeited_by IS NOT NULL
			AND m.forfeited_by != ?
			AND (i.from_id = ? OR i.to_id = ?)`,
		)
		.get(user.id, user.id, user.id) as { wins: number };

	// Get wins from forfeits
	let wins = winsResult.wins;

	// Get wins from score (only completed matches with 3 throws each)
	const scoreWinsResult = database
		.prepare(
			`SELECT COUNT(*) as score_wins
			FROM (
				SELECT
					m.invitation_id,
					i.from_id,
					i.to_id,
					SUM(CASE WHEN ta.player_id = ? THEN ta.score ELSE 0 END) as player_score,
					SUM(CASE WHEN ta.player_id != ? THEN ta.score ELSE 0 END) as opponent_score,
					COUNT(DISTINCT CASE WHEN ta.player_id = ? THEN ta.attempt_number END) as player_throws,
					COUNT(DISTINCT CASE WHEN ta.player_id != ? THEN ta.attempt_number END) as opponent_throws
				FROM match m
				JOIN invitation i ON m.invitation_id = i.id
				JOIN throw_attempt ta ON ta.match_id = m.invitation_id
				WHERE (i.from_id = ? OR i.to_id = ?)
				AND i.status = 'accepted'
				AND m.forfeited_by IS NULL
				GROUP BY m.invitation_id
				HAVING player_throws = 3 AND opponent_throws = 3
			)
			WHERE player_score > opponent_score`,
		)
		.get(user.id, user.id, user.id, user.id, user.id, user.id) as {
		score_wins: number;
	};

	wins += scoreWinsResult.score_wins;

	const losses = totalMatches - wins;
	const winRate =
		totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

	return {
		username,
		totalMatches,
		wins,
		losses,
		totalScore,
		winRate,
	};
}

const socketMap = new Map<string, Socket>();

export function sendToAll(message: object, excluded?: Set<string>) {
	if (excluded === undefined) {
		excluded = new Set();
	}

	Array.from(socketMap.entries())
		.filter(([username, _]) => !excluded.has(username))
		.forEach(([_, socket]) => {
			socket.write(JSON.stringify(message));
			socket.write('\n');
		});
}

export function onLoginSuccess(username: string, socket: Socket) {
	const message = { event: 'newUserOnline', body: { username } };

	const excluded = new Set<string>([username]);
	sendToAll(message, excluded);

	socketMap.set(username, socket);
}

export function listOnlineUser() {
	return Array.from(socketMap.keys()).map((username) => {
		const stats = getPlayerStats(db, username);
		return stats;
	});
}

export function isUserOnline(username: string) {
	return socketMap.has(username);
}

export function onUserLogout(username: string) {
	socketMap.delete(username);

	sendToAll({ event: 'userOffline', body: { username } });

	const playingMatch = getPlayingMatch(db, username);
	if (playingMatch) {
		onPlayerForfeited(db, username, playingMatch);
	}

	rejectAllChallenge(db, username);

	updateLastOnline(db, username);
}

export function getSocketFromUsername(username: string) {
	return socketMap.get(username);
}
