import db from "../configs/database.ts";
import type { Message } from "../schemas.ts";
import handleLogin from "./login.ts";
import handleRegister from "./register.ts";

async function handleMessage(message: Message): Promise<object> {
  switch (message.command) {
    case "login": {
      return await handleLogin(db, message.body);
    }

    case "register": {
      return await handleRegister(db, message.body);
    }
  }

  return {
    ok: false,
    message: "Invalid command.",
  };
}

export default handleMessage;
