import { Socket } from "net";
import { type Message, messageSchema } from "../schemas.ts";

type Callback = (message: Message) => void;

export function addMessageEvent(socket: Socket, callback: Callback) {
  function onPartReceived(part: string) {
    let message;

    try {
      message = JSON.parse(part);
    } catch {
      const message = JSON.stringify({
        ok: false,
        message: `Invalid JSON: ${part}`,
      });

      socket.write(message + "\n");
      return;
    }

    message = messageSchema.parse(message);

    console.log("Received:", message);
    callback(message as Message);
  }

  let buffer = "";

  socket.on("data", (data) => {
    buffer += data.toString();

    let parts = buffer.split("\n");
    buffer = parts.pop() || "";

    parts.forEach(onPartReceived);
  });
}
