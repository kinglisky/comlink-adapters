import * as Koa from 'koa';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { expose } from 'comlink';
import { socketIoEndpoint } from 'comlink-adapters';

const app = new Koa();
const httpServer = createServer(app.callback());
const io = new Server(httpServer, {
    serveClient: false,
    cors: {
        origin: 'http://127.0.0.1:5173',
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    },
    /* options */
});

io.on('connection', (socket) => {
    expose((a: number, b: number) => a + b, socketIoEndpoint(socket));

    console.log('connection');
});

httpServer.listen(3000);

console.log('Server:', 3000);
