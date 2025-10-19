import { Socket } from "net";

const socketMap = new Map<string, Socket>();

export function sendToAll(message: object, excluded?: Set<string>) {
  if (excluded === undefined) {
    excluded = new Set();
  }

  socketMap
    .entries()
    .filter(([username, _]) => !excluded.has(username))
    .forEach(([_, socket]) => {
      socket.write(JSON.stringify(message));
      socket.write("\n");
    });
}

export function onLoginSuccess(username: string, socket: Socket) {
  const message = { event: "newUserOnline", body: { username } };

  const excluded = new Set<string>([username]);
  sendToAll(message, excluded);

  socketMap.set(username, socket);
}

export function listOnlineUser() {
  return socketMap.keys().map((username) => ({ username }));
}

export function isUserOnline(username: string) {
  return socketMap.has(username);
}

export function onUserLogout(username: string) {
  socketMap.delete(username);

  // TODO: Check if is in match
  // TODO: Update last online

  const message = { event: "userOffline", body: { username } };
  sendToAll(message);
}

export function getSocketFromUsername(username: string) {
  return socketMap.get(username);
}
