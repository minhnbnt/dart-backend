import type { Socket } from "net";
import { ZodError } from "zod";

import { addMessageEvent } from "./utils/handleMessage.ts";
import handleCommand from "./routes/index.ts";
import { onLoginSuccess, onUserLogout } from "./service/socketMap.ts";
import type { Message } from "./schemas.ts";

function addSocketIfLoginSuccess(
  socket: Socket,
  request: Message,
  { ok }: { ok: boolean },
) {
  if (request.command !== "login") {
    return;
  }

  const username = request.body?.username;
  if (username !== undefined && ok) {
    onLoginSuccess(username, socket);
  }
}

async function handleMessage(
  socket: Socket,
  message: Message,
  username?: string,
) {
  try {
    const response = await handleCommand(message, username);
    addSocketIfLoginSuccess(socket, message, response);
    socket.write(JSON.stringify(response) + "\n");
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

  addMessageEvent(socket, (message) => {
    handleMessage(socket, message, username);
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
