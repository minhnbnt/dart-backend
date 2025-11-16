import * as z from 'zod';

export const messageSchema = z.object({
	id: z.uuid(),
	command: z.string().nonempty(),
	body: z.any(),
});

export const loginSchema = z.object({
	username: z.string().min(8),
	password: z.string().min(8),
});

export const challengeSchema = z.object({
	to: z.string().min(8),
});

export const challengeAnswerSchema = z.object({
	challengeId: z.int(),
	newStatus: z.enum(['accepted', 'declined']),
});

export const throwRequestSchema = z.object({
	score: z.int().min(0, { message: 'Value must be a non-negative integer' }),
	dx: z.number().optional(),
	dy: z.number().optional(),
	rotationAngle: z.number().optional(),
});

export const spinRequestSchema = z.object({
	rotationAmount: z.number().min(0),
	duration: z.number().min(0),
});

export const registerSchema = loginSchema;

export type ThrowRequest = z.infer<typeof throwRequestSchema>;
export type SpinRequest = z.infer<typeof spinRequestSchema>;
export type Message = z.infer<typeof messageSchema>;
export type RegisterPayload = z.infer<typeof registerSchema>;
