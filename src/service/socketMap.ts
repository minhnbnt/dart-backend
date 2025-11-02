import { Socket } from 'net';

import db from '../configs/database.ts';
import { updateLastOnline } from './auth.ts';
import { getPlayingMatch, onPlayerForfeited } from './gameplay.ts';
import { rejectAllChallenge } from './challenges.ts';

const socketMap = new Map<string, Socket>();

export function sendToAll(message: object, excluded?: Set<string>) {
	if (excluded === undefined) {
		excluded = new Set();
	}

	socketMap
		.entries()
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
	return socketMap.keys().map((username) => ({ username }));
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
