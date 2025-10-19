import type { Socket } from "net";
import { ZodError } from "zod";

import { addMessageEvent } from "./utils/handleMessage.ts";
import handleCommand from "./routes/index.ts";
import { onLoginSuccess, onUserLogout } from "./service/socketMap.ts";
import type { Message } from "./schemas.ts";

async function handleMessage(
  socket: Socket,
  message: Message,
  username?: string,
) {
  try {
    return await handleCommand(message, username);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        message: `Validation error.`,

        detail: JSON.parse(error.message),
      };
    }

    throw error;
  }
}

export function handleSocket(socket: Socket) {
  let username: string | undefined;

  addMessageEvent(socket, async (message) => {
    const response = await handleMessage(socket, message, username);
    const isLoginSuccess = message.command === "login" && response.ok;

    if (isLoginSuccess) {
      const { username: requestUsername } = message.body as any;
      username = requestUsername as string;

      onLoginSuccess(username, socket);
    }

    socket.write(JSON.stringify(response) + "\n");
  });

  socket.on("close", () => {
    if (username !== undefined) {
      onUserLogout(username);
      console.log(`Client ${username} disconnected.`);
    } else {
      console.log("Client disconnected.");
    }
  });

  socket.on("error", (err) => {
    console.error(err);
  });
}
