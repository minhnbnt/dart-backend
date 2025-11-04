import { type Database } from 'better-sqlite3';
import { throwRequestSchema } from '../schemas.ts';
import { onPlayerThrow } from '../service/gameplay.ts';

export function throwDart(db: Database, username: string, body: object) {
	const parsedBody = throwRequestSchema.parse(body);
	return onPlayerThrow(db, username, parsedBody);
}
