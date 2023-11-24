import {
    wrap,
    expose,
    proxyMarker,
    ProxyMarked,
    transferHandlers,
} from 'comlink';
import { isObject, generateUUID } from './utils';
import { MESSAGE_CHANNEL_NAME, PROXY_MESSAGE_CHANNEL_MARKER } from './constant';

import type { Endpoint, TransferHandler } from 'comlink';
import type { WebSocket as LibWebSocket } from 'ws';

const webSocketTransferHandlers: WeakMap<
    WebSocket,
    TransferHandler<unknown, unknown>
> = new Map();

const createProxyTransferHandler = (ws: WebSocket) => {
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
                webSocketEndpoint({
                    webSocket: ws,
                    messageChannel: proxyMessageChannelID,
                })
            );

            return [
                { [PROXY_MESSAGE_CHANNEL_MARKER]: proxyMessageChannelID },
                [],
            ];
        },
        deserialize(target) {
            return wrap(
                webSocketEndpoint({
                    webSocket: ws,
                    messageChannel: Reflect.get(
                        target,
                        PROXY_MESSAGE_CHANNEL_MARKER
                    ),
                })
            );
        },
    };

    return proxyTransferHandler;
};

/**
 * init WebSocket transferHandlers
 * @param messageChannelConstructor
 */
const initTransferHandlers = (ws: WebSocket) => {
    if (!webSocketTransferHandlers.has(ws)) {
        webSocketTransferHandlers.set(ws, createProxyTransferHandler(ws));

        const cleanup = () => {
            if (webSocketTransferHandlers.has(ws)) {
                webSocketTransferHandlers.delete(ws);
            }
        };

        ws.addEventListener('close', cleanup);
    }

    transferHandlers.set('proxy', webSocketTransferHandlers.get(ws)!);
};

export function webSocketEndpoint(options: {
    webSocket: WebSocket | LibWebSocket;
    messageChannel?: string;
}): Endpoint {
    const { webSocket, messageChannel } = options;
    const ws = webSocket as WebSocket;
    const listeners = new WeakMap();
    const channel = messageChannel || MESSAGE_CHANNEL_NAME;

    initTransferHandlers(ws);

    return {
        postMessage: (message: any, _transfer?: Transferable[]) => {
            ws.send(JSON.stringify({ message, __channel__: channel }));
        },

        addEventListener: (_, eh) => {
            const listener = (event: any) => {
                let data: any = null;
                try {
                    data = JSON.parse(event.data);
                } catch (_err) {
                    data = event.data;
                }

                if (
                    !data ||
                    !data.__channel__ ||
                    !data.message ||
                    data.__channel__ !== channel
                ) {
                    return;
                }

                if ('handleEvent' in eh) {
                    eh.handleEvent({ data: data.message } as MessageEvent);
                } else {
                    eh({ data: data.message } as MessageEvent);
                }
            };
            ws.addEventListener('message', listener);
            listeners.set(eh, listener);
        },

        removeEventListener: (_, eh) => {
            const listener = listeners.get(eh);
            if (!listener) {
                return;
            }
            ws.removeEventListener('message', listener);
            listeners.delete(eh);
        },

        start: () => {},
    };
}
