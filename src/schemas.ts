import * as z from "zod";

export const messageSchema = z.object({
  command: z.string().nonempty(),
  body: z.any(),
});

export const loginSchema = z.object({
  username: z.string().min(8),
  password: z.string().min(8),
});

export const registerSchema = loginSchema;

export type Message = z.infer<typeof messageSchema>;
export type RegisterPayload = z.infer<typeof registerSchema>;
