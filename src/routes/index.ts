import db from '../configs/database.ts';
import type { Message } from '../schemas.ts';
import { throwDart, spinDartboard } from './gameplay.ts';
import { listOnlineUser } from '../service/socketMap.ts';
import handleLogin from './login.ts';
import { answerChallenge, sendChallenge } from './matchMaking.ts';
import handleRegister from './register.ts';

async function handleCommand({ command, body }: Message, username?: string) {
	if (command === 'login') {
		return await handleLogin(db, body);
	} else if (command === 'register') {
		return await handleRegister(db, body);
	}

	if (username === undefined) {
		return {
			ok: false,
			message: 'Please login to continue.',
		};
	}

	switch (command) {
		case 'challengePlayer': {
			return sendChallenge(db, username, body);
		}

		case 'answerChallenge': {
			return answerChallenge(db, username, body);
		}

		case 'listOnline': {
			return { ok: true, body: listOnlineUser() };
		}

		case 'throw': {
			return throwDart(db, username, body);
		}

		case 'spin': {
			return spinDartboard(db, username, body);
		}
	}

	return {
		ok: false,
		message: 'Invalid command.',
	};
}

async function handleMessage(message: Message, username?: string) {
	const response: any = await handleCommand(message, username);
	response.id = message.id;

	return response;
}

export default handleMessage;
