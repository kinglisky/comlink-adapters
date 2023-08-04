import { MESSAGE_EVENT_NAME, MESSAGE_EVENT_ERROR } from './constant';

import type { Endpoint } from 'comlink';
import type { Socket as ServerSocket } from 'socket.io';
import type { Socket as ClientSocket } from 'socket.io-client';

export function socketIoEndpoint(
    socket: ServerSocket | ClientSocket,
    messageChannel: string = 'message'
): Endpoint {
    const listeners = new WeakMap();

    return {
        postMessage: (message: any, _transfer: MessagePort[]) => {
            socket.emit(messageChannel, message);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_EVENT_NAME) {
                throw new Error(MESSAGE_EVENT_ERROR);
            }

            const handler = (data: any) => {
                if ('handleEvent' in eventHandler) {
                    eventHandler.handleEvent({
                        data,
                        ports: [],
                    } as unknown as MessageEvent);
                } else {
                    eventHandler({
                        data,
                        ports: [],
                    } as unknown as MessageEvent);
                }
            };

            socket.on(messageChannel, handler);
            listeners.set(eventHandler, handler);
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_EVENT_NAME) {
                throw new Error(MESSAGE_EVENT_ERROR);
            }

            const handler = listeners.get(eventHandler);
            if (handler) {
                socket.off(messageChannel, handler);
                listeners.delete(eventHandler);
            }
        },
    };
}
