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

const electronMessagePortMarker = '__MESSAGE_PORT_MARKER__';

const rebuildMessagePortValue = <T extends MessagePort | MessagePortMain>(
    data: any,
    ports: Array<T>
) => {
    if (!ports.length || !data) {
        return data;
    }

    // get the original MessagePort from the ports list
    if (data?.value === electronMessagePortMarker) {
        data.value = ports[0];
    }

    if (typeof data === 'object') {
        return JSON.parse(JSON.stringify(data), (_, value) => {
            if (value && value === electronMessagePortMarker) {
                return ports[0];
            }
            return value;
        });
    }

    return data;
};

const isObject = (val: unknown): val is object =>
    (typeof val === 'object' && val !== null) || typeof val === 'function';

/**
 * Internal transfer handle to handle objects marked to proxy.
 * https://github.com/GoogleChromeLabs/comlink#transfer-handlers-and-event-listeners
 */
const proxyTransferHandler: TransferHandler<object, any> = {
    canHandle: (val): val is ProxyMarked => {
        console.log('proxyTransferHandler canHandle', val);
        return isObject(val) && (val as ProxyMarked)[proxyMarker];
    },
    serialize(obj) {
        console.log('proxyTransferHandler serialize', obj, process?.type);

        // main process
        if (process?.type === 'browser') {
            const { port1, port2 } = new MessageChannelMain();
            expose(obj, electronMessagePortMainEndpoint(port1));
            return [
                electronMessagePortMarker,
                [port2 as unknown as Transferable],
            ];
        }

        // renderer process
        const { port1, port2 } = new MessageChannel();
        expose(obj, port1);
        return [electronMessagePortMarker, [port2]];
    },
    deserialize(port: MessagePortMain | MessagePort) {
        port.start();
        const endpoint =
            port instanceof MessagePort
                ? port
                : electronMessagePortMainEndpoint(port as MessagePortMain);
        console.log('proxyTransferHandler deserialize', { port, endpoint });

        return wrap(endpoint);
    },
};

const connectMessagePort = (portA: MessagePort, portB: MessagePortMain) => {
    portA.addEventListener('message', (evt) => {
        console.log('MessagePort message', evt);
        portB.postMessage(evt.data, []);
    });

    portA.addEventListener('close', (evt) => {
        console.log('MessagePort close', evt);
        portB.close();
    });

    portB.addListener('message', (evt) => {
        console.log('MessagePortMain message', evt);
        portA.postMessage(evt.data, []);
    });

    portB.addListener('close', () => {
        console.log('MessagePortMain close');
        portA.close();
    });

    portA.start();
    portB.start();
};

/**
 * Internal transfer handle to handle objects marked to proxy.
 */
const messagePortTransferHandler: TransferHandler<
    MessagePortMain | MessagePort,
    any
> = {
    canHandle: (val): val is MessagePortMain | MessagePort => {
        console.log('messagePortTransferHandler canHandle', val);
        return !!(
            val &&
            typeof val === 'object' &&
            Reflect.get(val, 'start') &&
            Reflect.get(val, 'postMessage')
        );
    },
    serialize(port: MessagePort) {
        console.log('messagePortTransferHandler serialize', port);
        // In the main process, only MessagePortMain can be passed through postMessage
        // so a new proxy MessagePortMain needs to be created to connect to the original MessagePort
        if (process?.type === 'browser') {
            const { port1, port2 } = new MessageChannelMain();
            connectMessagePort(port, port1);
            return [
                electronMessagePortMarker,
                [port2 as unknown as Transferable],
            ];
        }
        return [electronMessagePortMarker, [port]];
    },
    deserialize(port: MessagePortMain | MessagePort) {
        console.log('messagePortTransferHandler deserialize', port);
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
    transferHandlers.set('proxy', proxyTransferHandler);
    transferHandlers.set('messagePort', messagePortTransferHandler);

    const listeners = new WeakMap();
    const { messageChannel = MESSAGE_CHANNEL } = options || {};

    return {
        postMessage: (message: any, transfer: MessagePort[]) => {
            ipcRenderer.postMessage(messageChannel, message, transfer);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = (evt: IpcRendererEvent, ...args: any[]) => {
                const { ports } = evt;

                // get the original MessagePort from the ports list
                const data = rebuildMessagePortValue<MessagePort>(
                    args[0],
                    ports
                );

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
    transferHandlers.set('proxy', proxyTransferHandler);
    transferHandlers.set('messagePort', messagePortTransferHandler);

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
            port.postMessage(message, transfer || []);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = (evt: MessageEventMain) => {
                console.log(
                    'electronMessagePortMainEndpoint addEventListener',
                    evt
                );
                const data = rebuildMessagePortValue<MessagePortMain>(
                    evt.data,
                    evt.ports
                );

                if ('handleEvent' in eventHandler) {
                    eventHandler.handleEvent({
                        data,
                        ports: evt.ports,
                    } as unknown as MessageEvent);
                } else {
                    eventHandler({
                        data,
                        ports: evt.ports,
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
    transferHandlers.set('proxy', proxyTransferHandler);
    transferHandlers.set('messagePort', messagePortTransferHandler);

    const { sender, messageChannel = MESSAGE_CHANNEL } = options;
    const listeners = new WeakMap();

    return {
        postMessage: (message: any, transfer: any[]) => {
            sender.postMessage(messageChannel, message, transfer);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = (evt: IpcMainEvent, ...args: any[]) => {
                const { ports } = evt;

                const data = rebuildMessagePortValue(args[0], ports);

                console.log('electronMainEndpoint addEventListener', {
                    data,
                    ports,
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
