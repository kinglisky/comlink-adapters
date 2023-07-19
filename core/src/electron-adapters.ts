import {
    expose,
    wrap,
    proxyMarker,
    transferHandlers,
    ProxyMarked,
} from 'comlink';
import { isObject } from './utils';
import {
    MESSAGE_CHANNEL_NAME,
    MESSAGE_EVENT_NAME,
    MESSAGE_EVENT_ERROR,
    MESSAGE_PORT_MARKER,
} from './constant';

import type { Endpoint, TransferHandler } from 'comlink';
import type {
    IpcRenderer,
    IpcRendererEvent,
    IpcMain,
    IpcMainEvent,
    WebContents,
    MessageEvent as MessageEventMain,
    MessagePortMain,
    MessageChannelMain,
} from 'electron';

const rebuildMessagePortValue = <T extends MessagePort | MessagePortMain>(
    data: any,
    ports: Array<T>
) => {
    if (!ports.length || !data) {
        return data;
    }

    // get the original MessagePort from the ports list
    if (data?.value === MESSAGE_PORT_MARKER) {
        data.value = ports[0];
        return data;
    }

    if (typeof data === 'object') {
        return JSON.parse(JSON.stringify(data), (_, value) => {
            if (value && value === MESSAGE_PORT_MARKER) {
                return ports[0];
            }
            return value;
        });
    }

    return data;
};

const electronTransferHandlers: Map<
    'proxy' | 'messagePort',
    TransferHandler<unknown, unknown>
> = new Map();

/**
 * Internal transfer handle to handle objects marked to proxy.
 * https://github.com/GoogleChromeLabs/comlink#transfer-handlers-and-event-listeners
 */
const createProxyTransferHandler = (
    messageChannelConstructor?: new () => MessageChannelMain
) => {
    const proxyTransferHandler: TransferHandler<object, any> = {
        canHandle: (val): val is ProxyMarked => {
            return isObject(val) && (val as ProxyMarked)[proxyMarker];
        },
        serialize(obj) {
            // main process
            if (messageChannelConstructor) {
                const { port1, port2 } = new messageChannelConstructor();
                expose(
                    obj,
                    electronMessagePortMainEndpoint(
                        port1,
                        messageChannelConstructor
                    )
                );
                return [
                    MESSAGE_PORT_MARKER,
                    [port2 as unknown as Transferable],
                ];
            }

            // renderer process
            const { port1, port2 } = new MessageChannel();
            expose(obj, port1);
            return [MESSAGE_PORT_MARKER, [port2]];
        },
        deserialize(port: MessagePortMain | MessagePort) {
            port.start();
            const endpoint =
                port instanceof MessagePort
                    ? port
                    : electronMessagePortMainEndpoint(
                          port as MessagePortMain,
                          messageChannelConstructor
                      );

            return wrap(endpoint);
        },
    };

    return proxyTransferHandler;
};

/**
 * MessagePort transfer handle.
 */
const createMessagePortTransferHandler = (
    messageChannelConstructor?: new () => MessageChannelMain
) => {
    const messagePortTransferHandler: TransferHandler<
        MessagePortMain | MessagePort,
        any
    > = {
        canHandle: (val): val is MessagePortMain | MessagePort => {
            return !!(
                val &&
                typeof val === 'object' &&
                Reflect.get(val, 'start') &&
                Reflect.get(val, 'postMessage')
            );
        },
        serialize(port: MessagePort) {
            // In the main process, only MessagePortMain can be passed through postMessage
            // so a new proxy MessagePortMain needs to be created to connect to the original MessagePort
            if (messageChannelConstructor) {
                const { port1, port2 } = new messageChannelConstructor();
                connectMessagePort(port, port1);
                return [
                    MESSAGE_PORT_MARKER,
                    [port2 as unknown as Transferable],
                ];
            }
            return [MESSAGE_PORT_MARKER, [port]];
        },
        deserialize(port: MessagePortMain | MessagePort) {
            port.start();
            return port;
        },
    };
    return messagePortTransferHandler;
};

/**
 * init electron transferHandlers
 * @param messageChannelConstructor
 */
const initTransferHandlers = (
    messageChannelConstructor?: new () => MessageChannelMain
) => {
    if (!electronTransferHandlers.has('proxy')) {
        electronTransferHandlers.set(
            'proxy',
            createProxyTransferHandler(messageChannelConstructor)
        );
    }

    if (!electronTransferHandlers.has('messagePort')) {
        electronTransferHandlers.set(
            'messagePort',
            createMessagePortTransferHandler(messageChannelConstructor)
        );
    }

    transferHandlers.set(
        'messagePort',
        electronTransferHandlers.get('messagePort')!
    );
    transferHandlers.set('proxy', electronTransferHandlers.get('proxy')!);
};

const connectMessagePort = (portA: MessagePort, portB: MessagePortMain) => {
    portA.addEventListener('message', (evt) => {
        portB.postMessage(evt.data, []);
    });

    portA.addEventListener('close', () => {
        portB.close();
    });

    portB.addListener('message', (evt) => {
        portA.postMessage(evt.data, []);
    });

    portB.addListener('close', () => {
        portA.close();
    });

    portA.start();
    portB.start();
};

/**
 * create electron messagePortMain endpoint
 * @param options
 * @returns
 */
export function electronMessagePortMainEndpoint(
    port: MessagePortMain,
    messageChannelConstructor?: new () => MessageChannelMain
): Endpoint {
    initTransferHandlers(messageChannelConstructor);

    const listeners = new WeakMap();

    return {
        start: () => {
            return port.start();
        },

        // transfer is MessagePortMain[]
        postMessage: (message: any, transfer: any[]) => {
            port.postMessage(message, transfer || []);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_EVENT_NAME) {
                throw new Error(MESSAGE_EVENT_ERROR);
            }

            const handler = (evt: MessageEventMain) => {
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
            port.addListener(MESSAGE_EVENT_NAME, handler);
            listeners.set(eventHandler, handler);
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_EVENT_NAME) {
                throw new Error(MESSAGE_EVENT_ERROR);
            }

            const handler = listeners.get(eventHandler);
            if (handler) {
                port.removeListener(MESSAGE_EVENT_NAME, handler);
                listeners.delete(eventHandler);
            }
        },
    };
}

/**
 * create electron renderer endpoint
 * @param options
 * @returns
 */
export function electronRendererEndpoint(options: {
    ipcRenderer: IpcRenderer;
    channelName?: string;
}): Endpoint {
    initTransferHandlers();

    const listeners = new WeakMap();
    const { ipcRenderer, channelName = MESSAGE_CHANNEL_NAME } = options;

    return {
        postMessage: (message: any, transfer: MessagePort[]) => {
            ipcRenderer.postMessage(channelName, message, transfer);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_EVENT_NAME) {
                throw new Error(MESSAGE_EVENT_ERROR);
            }

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
            ipcRenderer.on(channelName, handler);
            listeners.set(eventHandler, handler);
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_EVENT_NAME) {
                throw new Error(MESSAGE_EVENT_ERROR);
            }

            const handler = listeners.get(eventHandler);
            if (handler) {
                ipcRenderer.removeListener(channelName, handler);
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
    ipcMain: IpcMain;
    messageChannelConstructor: new () => MessageChannelMain;
    channelName?: string;
}): Endpoint {
    const {
        sender,
        ipcMain,
        messageChannelConstructor,
        channelName = MESSAGE_CHANNEL_NAME,
    } = options;

    initTransferHandlers(messageChannelConstructor);

    const listeners = new WeakMap();

    return {
        postMessage: (message: any, transfer: any[]) => {
            sender.postMessage(channelName, message, transfer);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_EVENT_NAME) {
                throw new Error(MESSAGE_EVENT_ERROR);
            }

            const handler = (evt: IpcMainEvent, ...args: any[]) => {
                const { ports } = evt;

                const data = rebuildMessagePortValue(args[0], ports);

                if ('handleEvent' in eventHandler) {
                    eventHandler.handleEvent({
                        data,
                        ports,
                    } as unknown as MessageEvent);
                } else {
                    eventHandler({ data, ports } as unknown as MessageEvent);
                }
            };
            ipcMain.on(channelName, handler);
            listeners.set(eventHandler, handler);
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_EVENT_NAME) {
                throw new Error(MESSAGE_EVENT_ERROR);
            }

            const handler = listeners.get(eventHandler);
            if (handler) {
                ipcMain.removeListener(channelName, handler);
                listeners.delete(eventHandler);
            }
        },
    };
}
