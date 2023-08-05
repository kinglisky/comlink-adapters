import { io } from 'socket.io-client';
import { socketIoEndpoint } from 'comlink-adapters';
import { wrapCounter } from '@examples/test';

export function setupTestCounter(
    button: HTMLButtonElement,
    output: HTMLPreElement
) {
    const socket = io('ws://localhost:3000');
    const testCounter = wrapCounter(socketIoEndpoint(socket));

    const startTestCounter = async () => {
        output.innerHTML = 'Test Counter Cases:';
        const result = await testCounter(output);
        console.log('startTestCounter', result);
    };

    button.addEventListener('click', () => startTestCounter());
}
