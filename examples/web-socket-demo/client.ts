import WebSocket from 'ws';
import { webSocketEndpoint } from 'comlink-adapters';
import { wrapCounter } from '@examples/test-case';

const serverAddress = 'ws://localhost:8888';

const ws = new WebSocket(serverAddress);

ws.on('open', async () => {
    const testCounter = wrapCounter(webSocketEndpoint({ webSocket: ws }));
    const result = await testCounter();
    console.log('testCounter result:', result);
});

if (process.send) {
    process.send('ready');
}
