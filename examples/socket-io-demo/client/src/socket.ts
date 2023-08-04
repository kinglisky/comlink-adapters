import { io } from 'socket.io-client';
import { wrap } from 'comlink';
import { socketIoEndpoint } from 'comlink-adapters';

export async function useSocketIo() {
    const socket = io('ws://localhost:3000');
    const add = wrap<(a: number, b: number) => number>(
        socketIoEndpoint(socket)
    );
    const res = await add(4, 2);
    console.log(res);
}
