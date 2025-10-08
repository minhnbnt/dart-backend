import { Socket, createServer } from "net";

import handleMessage from "./routes/index.ts";
import { addMessageEvent } from "./utils/handleMessage.ts";

const server = createServer((socket: Socket) => {
  console.log("Client connected:", socket.remoteAddress, socket.remotePort);

  addMessageEvent(socket, async (message) => {
    const response = await handleMessage(message);
    socket.write(JSON.stringify(response) + "\n");
  });

  socket.on("end", () => {
    console.log("Client disconnected");
  });

  socket.on("error", (err: Error) => {
    console.error("Socket error:", err.message);
  });
});

server.listen(5000, () => {
  console.log("TCP server listening on port 5000");
});
