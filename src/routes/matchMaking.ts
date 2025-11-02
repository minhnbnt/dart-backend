import { type Database } from 'better-sqlite3';

import { challengeAnswerSchema, challengeSchema } from '../schemas.ts';
import { getSocketFromUsername } from '../service/socketMap.ts';
import {
	checkCanAnswer,
	insertChallenge,
	onChallengeAccepted,
	updateChallenge,
} from '../service/challenges.ts';

export function answerChallenge(db: Database, username: string, body: object) {
	const { challengeId, newStatus } = challengeAnswerSchema.parse(body);

	try {
		const challenge = checkCanAnswer(db, username, challengeId);
		updateChallenge(db, challengeId, newStatus);
		if (newStatus === 'accepted') {
			onChallengeAccepted(challenge);
		}
	} catch (err) {
		if (
			err instanceof Error &&
			err.message.toLowerCase().includes('challenge')
		) {
			return {
				ok: false,
				message: err.message,
			};
		}

		throw err;
	}

	return { ok: true };
}

export function sendChallenge(db: Database, from: string, message: object) {
	const { to } = challengeSchema.parse(message);

	const isSelfChallenge = from === to;
	if (isSelfChallenge) {
		return {
			ok: false,
			message: "You can't send a challenge to yourself.",
		};
	}

	const toSocket = getSocketFromUsername(to);

	const isOnline = toSocket !== undefined;
	if (!isOnline) {
		return {
			ok: false,
			message: `"${to}" is not online right now.`,
		};
	}

	const newChallengeId = insertChallenge(db, from, to);

	toSocket.write(
		JSON.stringify({
			event: 'newChallenger',
			body: { from, challengeId: newChallengeId },
		}) + '\n',
	);

	return {
		ok: true,
		body: { message: `Sent the challenge to "${to}".` },
	};
}
