import { ipcMain, ipcRenderer } from 'electron';
import { MESSAGE_CHANNEL, MESSAGE_NAME } from './constant';

import type { Endpoint } from 'comlink';
import type { IpcRendererEvent, IpcMainEvent, WebContents } from 'electron';

/**
 * create electron renderer endpoint
 * @param options
 * @returns
 */
export function createRendererEndpoint(options?: {
    messageChannel: string;
}): Endpoint {
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
 * create electron main endpoint
 * @param options
 * @returns
 */
export function createMainEndpoint(options: {
    sender: WebContents;
    messageChannel?: string;
}): Endpoint {
    const { sender, messageChannel = MESSAGE_CHANNEL } = options;
    const listeners = new WeakMap();

    return {
        postMessage: (message: any, transfer: any[]) => {
            sender.postMessage(messageChannel, message, transfer);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = (__: IpcMainEvent, ...args: any[]) => {
                const [data] = args;
                if ('handleEvent' in eventHandler) {
                    eventHandler.handleEvent({ data } as MessageEvent);
                } else {
                    eventHandler({ data } as MessageEvent);
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
