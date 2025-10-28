import { Socket, createServer } from 'net';
import { handleSocket } from './userSocket.ts';

const server = createServer((socket: Socket) => {
	console.log('Client connected:', socket.remoteAddress, socket.remotePort);
	handleSocket(socket);
});

server.listen(5000, () => {
	console.log('TCP server listening on port 5000');
});
