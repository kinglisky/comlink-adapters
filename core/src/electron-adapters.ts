import { ipcMain, ipcRenderer, MessageChannelMain } from 'electron';
import {
    expose,
    wrap,
    proxyMarker,
    transferHandlers,
    ProxyMarked,
} from 'comlink';
import { MESSAGE_CHANNEL, MESSAGE_NAME } from './constant';

import type { Endpoint, TransferHandler } from 'comlink';
import type {
    IpcRendererEvent,
    IpcMainEvent,
    WebContents,
    MessageEvent as MessageEventMain,
    MessagePortMain,
} from 'electron';

const isObject = (val: unknown): val is object =>
    (typeof val === 'object' && val !== null) || typeof val === 'function';

/**
 * Internal transfer handle to handle objects marked to proxy.
 */
const mainProxyTransferHandler: TransferHandler<object, any> = {
    canHandle: (val): val is ProxyMarked => {
        console.log('mainProxyTransferHandler canHandle', val);
        return isObject(val) && (val as ProxyMarked)[proxyMarker];
    },
    serialize(obj) {
        const { port1, port2 } = new MessageChannelMain();
        expose(obj, electronMessagePortMainEndpoint(port1));
        const res = [null, [port2 as unknown as Transferable]];
        console.log('mainProxyTransferHandler serialize', obj, res);

        return res;
    },
    deserialize(port: MessagePortMain | MessagePort) {
        port.start();
        const endpoint =
            port instanceof MessagePort
                ? port
                : electronMessagePortMainEndpoint(port as MessagePortMain);

        console.log('mainProxyTransferHandler deserialize', endpoint);

        return wrap(endpoint);
    },
};

const messagePortMainMarker = '__MESSAGE_PORT_MAIN_MARKER__';

/**
 * Internal transfer handle to handle objects marked to proxy.
 */
const messagePortMainTransferHandler: TransferHandler<
    object,
    MessagePort | MessagePortMain
> = {
    canHandle: (val): val is MessagePortMain | MessagePort => {
        console.log('messagePortMainTransferHandler canHandle', val);
        return !!(
            val &&
            typeof val === 'object' &&
            Reflect.get(val, 'start') &&
            Reflect.get(val, 'postMessage')
        );
    },
    serialize(port: MessagePort) {
        const { port1, port2 } = new MessageChannelMain();

        port.addEventListener('message', (evt) => {
            console.log('proxy port message', evt);
            port1.postMessage(evt.data, evt.ports);
        });

        port.addEventListener('close', (evt) => {
            console.log('proxy port close', evt);
            port1.close();
        });

        port1.addListener('message', (evt) => {
            console.log('proxy port1 message', evt);
            port.postMessage(evt.data, evt.ports);
        });

        port1.addListener('close', () => {
            console.log('proxy port1 close');
            port.close();
        });

        port2.addListener('message', (evt) => {
            console.log('proxy port2 message', evt);
        });

        port2.addListener('close', () => {
            console.log('proxy port2 close');
        });

        port.start();
        port1.start();
        port2.start();

        console.log('messagePortMainTransferHandler serialize', port);

        return [
            { [messagePortMainMarker]: true } as any,
            [port2 as unknown as Transferable],
        ];
    },
    deserialize(port: MessagePortMain | MessagePort) {
        console.log('messagePortMainTransferHandler deserialize', port);

        port.start();

        return port;
    },
};

/**
 * create electron renderer endpoint
 * @param options
 * @returns
 */
export function electronRendererEndpoint(options?: {
    messageChannel: string;
}): Endpoint {
    transferHandlers.set('messagePort', messagePortMainTransferHandler);

    const listeners = new WeakMap();
    const { messageChannel = MESSAGE_CHANNEL } = options || {};

    return {
        postMessage: (message: any, transfer: MessagePort[]) => {
            console.log('electronRendererEndpoint postMessage', {
                message,
                transfer,
            });
            ipcRenderer.postMessage(messageChannel, message, transfer);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = (evt: IpcRendererEvent, ...args: any[]) => {
                const { ports } = evt;

                const data = args[0];
                if (
                    ports.length &&
                    (data?.name === 'proxy' ||
                        Reflect.get(data?.value || {}, messagePortMainMarker))
                ) {
                    data.value = ports[0];
                }

                console.log('electronRendererEndpoint addEventListener', {
                    evt,
                    data,
                });

                if ('handleEvent' in eventHandler) {
                    eventHandler.handleEvent({
                        data,
                        ports,
                    } as unknown as MessageEvent);
                } else {
                    eventHandler({
                        data,
                        ports,
                    } as unknown as MessageEvent);
                }
            };
            ipcRenderer.on(messageChannel, handler);
            listeners.set(eventHandler, handler);
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = listeners.get(eventHandler);
            if (handler) {
                ipcRenderer.removeListener(messageChannel, handler);
                listeners.delete(eventHandler);
            }
        },
    };
}

/**
 * create electron messagePortMain endpoint
 * @param options
 * @returns
 */
export function electronMessagePortMainEndpoint(
    port: MessagePortMain
): Endpoint {
    transferHandlers.set('proxy', mainProxyTransferHandler);
    transferHandlers.set('messagePort', messagePortMainTransferHandler);

    const listeners = new WeakMap();

    return {
        start: () => {
            return port.start();
        },

        // transfer is MessagePortMain[]
        postMessage: (message: any, transfer: any[]) => {
            console.log('electronMessagePortMainEndpoint postMessage', {
                message,
                transfer,
            });
            port.postMessage(message, transfer);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = (messageEvent: MessageEventMain) => {
                const { data, ports } = messageEvent;
                console.log('electronMessagePortMainEndpoint addListener', {
                    data,
                    ports,
                });

                if ('handleEvent' in eventHandler) {
                    eventHandler.handleEvent({
                        data,
                        ports,
                    } as unknown as MessageEvent);
                } else {
                    eventHandler({
                        data,
                        ports,
                    } as unknown as MessageEvent);
                }
            };
            port.addListener(MESSAGE_NAME, handler);
            listeners.set(eventHandler, handler);
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = listeners.get(eventHandler);
            if (handler) {
                port.removeListener(MESSAGE_NAME, handler);
                listeners.delete(eventHandler);
            }
        },
    };
}

/**
 * create electron main endpoint
 * @param options
 * @returns
 */
export function electronMainEndpoint(options: {
    sender: WebContents;
    messageChannel?: string;
}): Endpoint {
    transferHandlers.set('proxy', mainProxyTransferHandler);
    transferHandlers.set('messagePort', messagePortMainTransferHandler);

    const { sender, messageChannel = MESSAGE_CHANNEL } = options;
    const listeners = new WeakMap();

    return {
        postMessage: (message: any, transfer: any[]) => {
            console.log('electronMainEndpoint postMessage', {
                message,
                transfer,
            });
            sender.postMessage(messageChannel, message, transfer);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = (evt: IpcMainEvent, ...args: any[]) => {
                const { ports } = evt;
                const [data] = args;

                console.log('electronMainEndpoint addEventListener', {
                    ports,
                    data,
                });

                if ('handleEvent' in eventHandler) {
                    eventHandler.handleEvent({
                        data,
                        ports,
                    } as unknown as MessageEvent);
                } else {
                    eventHandler({ data, ports } as unknown as MessageEvent);
                }
            };
            ipcMain.on(messageChannel, handler);
            listeners.set(eventHandler, handler);
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = listeners.get(eventHandler);
            if (handler) {
                ipcMain.removeListener(messageChannel, handler);
                listeners.delete(eventHandler);
            }
        },
    };
}
