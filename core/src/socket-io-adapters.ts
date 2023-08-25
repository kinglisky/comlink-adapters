import {
    wrap,
    expose,
    proxyMarker,
    ProxyMarked,
    transferHandlers,
} from 'comlink';
import { isObject, generateUUID } from './utils';
import {
    MESSAGE_CHANNEL_NAME,
    MESSAGE_EVENT_NAME,
    MESSAGE_EVENT_ERROR,
} from './constant';

import type { Endpoint, TransferHandler } from 'comlink';
import type { Socket as ServerSocket } from 'socket.io';
import type { Socket as ClientSocket } from 'socket.io-client';

const PROXY_MESSAGE_CHANNEL_ID = '__PROXY_MESSAGE_CHANNEL_ID__';

const socketIOTransferHandlers: WeakMap<
    ServerSocket | ClientSocket,
    TransferHandler<unknown, unknown>
> = new Map();

const createProxyTransferHandler = (socket: ServerSocket | ClientSocket) => {
    /**
     * Internal transfer handle to handle objects marked to proxy.
     * https://github.com/GoogleChromeLabs/comlink#transfer-handlers-and-event-listeners
     */
    const proxyTransferHandler: TransferHandler<object, any> = {
        canHandle: (val): val is ProxyMarked => {
            return isObject(val) && (val as ProxyMarked)[proxyMarker];
        },
        serialize(obj) {
            const proxyMessageChannelID = generateUUID();
            expose(
                obj,
                socketIoEndpoint({
                    socket,
                    messageChannel: proxyMessageChannelID,
                })
            );

            return [{ [PROXY_MESSAGE_CHANNEL_ID]: proxyMessageChannelID }, []];
        },
        deserialize(target) {
            return wrap(
                socketIoEndpoint({
                    socket,
                    messageChannel: Reflect.get(
                        target,
                        PROXY_MESSAGE_CHANNEL_ID
                    ),
                })
            );
        },
    };

    return proxyTransferHandler;
};

/**
 * init socketIO transferHandlers
 * @param messageChannelConstructor
 */
const initTransferHandlers = (socket: ServerSocket | ClientSocket) => {
    if (!socketIOTransferHandlers.has(socket)) {
        socketIOTransferHandlers.set(
            socket,
            createProxyTransferHandler(socket)
        );

        socket.on('disconnect', () => {
            if (socketIOTransferHandlers.has(socket)) {
                socketIOTransferHandlers.delete(socket);
            }
        });
    }

    transferHandlers.set('proxy', socketIOTransferHandlers.get(socket)!);
};

export function socketIoEndpoint(options: {
    socket: ServerSocket | ClientSocket;
    messageChannel?: string;
}): Endpoint {
    const listeners = new WeakMap();
    const { socket, messageChannel = MESSAGE_CHANNEL_NAME } = options;

    initTransferHandlers(socket);

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
