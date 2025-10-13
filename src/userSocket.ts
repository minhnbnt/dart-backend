import type { Socket } from "net";
import { addMessageEvent } from "./utils/handleMessage.ts";
import handleCommand from "./routes/index.ts";

const socketMap = new Map<string, Socket>();

export function listOnlineUser() {
  return socketMap.keys();
}

function onLoginSuccess(username: string, socket: Socket) {
  const message = {
    type: "event",
    body: { event: "newUser", username },
  };

  socketMap.forEach((socket) => {
    socket.write(JSON.stringify(message));
    socket.write("\n");
  });

  socketMap.set(username, socket);
}

export function handleSocket(socket: Socket) {
  let username: string | null = null;

  addMessageEvent(socket, async (message) => {
    const response = await handleCommand(message);
    socket.write(JSON.stringify(response) + "\n");

    const isLoginSuccess = message.command === "login" && response.ok === true;

    if (isLoginSuccess) {
      const responseAny = response as any;
      username = responseAny.body.username as string;

      onLoginSuccess(username, socket);
    }
  });

  socket.on("close", () => {
    if (username !== null) {
      socketMap.delete(username);
      console.log(`Client ${username} disconnected.`);
    } else {
      console.log("Client disconnected.");
    }
  });

  socket.on("error", (err) => {
    console.error(err);
  });
}
