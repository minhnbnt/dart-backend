import { type Database } from 'better-sqlite3';
import { throwRequestSchema, spinRequestSchema } from '../schemas.ts';
import { onPlayerThrow, onPlayerSpin } from '../service/gameplay.ts';

export function throwDart(db: Database, username: string, body: object) {
	const parsedBody = throwRequestSchema.parse(body);
	return onPlayerThrow(db, username, parsedBody);
}

export function spinDartboard(db: Database, username: string, body: object) {
	const parsedBody = spinRequestSchema.parse(body);
	return onPlayerSpin(db, username, parsedBody);
}
