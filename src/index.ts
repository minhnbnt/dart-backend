import net, { Socket } from "net";

import handleMessage from "./routes/index.ts";

function handleMessagePart(socket: Socket, part: string) {
  try {
    const msg = JSON.parse(part);
    console.log("Received:", msg);

    handleMessage(msg).then((response) => {
      socket.write(JSON.stringify(response) + "\n");
    });
  } catch {
    console.error("Invalid JSON:", part);
  }
}

const server = net.createServer((socket: Socket) => {
  console.log("Client connected:", socket.remoteAddress, socket.remotePort);

  let buffer = "";

  socket.on("data", (data: Buffer) => {
    buffer += data.toString();

    let parts = buffer.split("\n");
    buffer = parts.pop() || "";

    parts.forEach((part) => handleMessagePart(socket, part));
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
