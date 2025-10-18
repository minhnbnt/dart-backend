import * as z from "zod";

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
  newStatus: z.enum(["accepted", "declined"]),
});

export const registerSchema = loginSchema;

export type Message = z.infer<typeof messageSchema>;
export type RegisterPayload = z.infer<typeof registerSchema>;
