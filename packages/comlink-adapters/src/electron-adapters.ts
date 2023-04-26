import { ipcMain, ipcRenderer } from 'electron';

import type { Endpoint } from 'comlink';
import type { IpcRendererEvent, IpcMainEvent } from 'electron';

const RPC_MESSAGE_CHANNEL = '';
const MESSAGE_NAME = '';

// render 进程中使用
export function rendererEndpoint(options?: {
    messageChannel: string;
}): Endpoint {
    const listeners = new WeakMap();
    const { messageChannel = RPC_MESSAGE_CHANNEL } = options || {};
    return {
        postMessage: (message: any, transfer: MessagePort[]) => {
            ipcRenderer.postMessage(messageChannel, message, transfer);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName === MESSAGE_NAME) {
                const handler = (evt: IpcRendererEvent, ...args: any[]) => {
                    const { ports } = evt;
                    const data = args[0];
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
            }
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName === MESSAGE_NAME) {
                const handler = listeners.get(eventHandler);
                if (handler) {
                    ipcRenderer.removeListener(messageChannel, handler);
                    listeners.delete(eventHandler);
                }
            }
        },
    };
}

export function mainEndpoint(options: {
    target: Endpoint;
    messageChannel?: string;
}): Endpoint {
    const { target, messageChannel = RPC_MESSAGE_CHANNEL } = options;
    const listeners = new WeakMap();
    return {
        postMessage: (message: any, transfer: any[]) => {
            target.postMessage(message, transfer);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName === MESSAGE_NAME) {
                const handler = (_: IpcMainEvent, ...args: any[]) => {
                    const [data] = args;
                    if ('handleEvent' in eventHandler) {
                        eventHandler.handleEvent({ data } as MessageEvent);
                    } else {
                        eventHandler({ data } as MessageEvent);
                    }
                };
                ipcMain.on(messageChannel, handler);
                listeners.set(eventHandler, handler);
            }
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName === MESSAGE_NAME) {
                const handler = listeners.get(eventHandler);
                if (handler) {
                    ipcMain.removeListener(messageChannel, handler);
                    listeners.delete(eventHandler);
                }
            }
        },
    };
}
