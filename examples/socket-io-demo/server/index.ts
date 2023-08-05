import Koa from 'koa';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { socketIoEndpoint } from 'comlink-adapters';
import { exposeCounter } from '@examples/test';

const app = new Koa();
const httpServer = createServer(app.callback());
const io = new Server(httpServer, {
    serveClient: false,
    cors: {
        origin: 'http://127.0.0.1:5173',
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    },
});

io.on('connection', (socket) => {
    exposeCounter(socketIoEndpoint({ socket }));
    console.log('socket connected');
});

httpServer.listen(3000);

console.log('Server:', 3000);
