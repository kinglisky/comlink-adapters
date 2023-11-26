import { webSocketEndpoint } from 'comlink-adapters';
import { exposeCounter } from '@examples/test-case';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8888 });

wss.addListener('connection', (ws: WebSocket) => {
    exposeCounter(webSocketEndpoint({ webSocket: ws }));
});

if (process.send) {
    process.send('ready');
}
