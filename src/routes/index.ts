import db from "../configs/database.ts";
import type { Message } from "../schemas.ts";
import { listOnlineUser } from "../userSocket.ts";
import handleLogin from "./login.ts";
import handleRegister from "./register.ts";

async function handleCommand(message: Message) {
  switch (message.command) {
    case "login": {
      return await handleLogin(db, message.body);
    }

    case "register": {
      return await handleRegister(db, message.body);
    }

    case "listOnline": {
      return {
        ok: true,
        body: listOnlineUser().toArray(),
      };
    }
  }

  return {
    ok: false,
    message: "Invalid command.",
  };
}

async function handleMessage(message: Message) {
  const response = (await handleCommand(message)) as any;
  response.id = message.id;

  return response;
}

export default handleMessage;
