import { proxyMarker, ProxyMarked, transferHandlers } from 'comlink';
import { isObject } from './utils';
import { MESSAGE_EVENT_NAME, MESSAGE_EVENT_ERROR } from './constant';

import type { Endpoint, TransferHandler } from 'comlink';

/**
 * Internal transfer handle to handle objects marked to proxy.
 * https://github.com/GoogleChromeLabs/comlink#transfer-handlers-and-event-listeners
 */
const proxyTransferHandler: TransferHandler<object, any> = {
    canHandle: (val): val is ProxyMarked => {
        return isObject(val) && (val as ProxyMarked)[proxyMarker];
    },
    serialize() {
        return [null, []];
    },
    deserialize() {
        return function () {
            throw new Error('Operation not supported');
        };
    },
};

/**
 * create runtime port endpoint(Long-lived connections)
 * https://developer.chrome.com/docs/extensions/mv3/messaging/#connect
 * @param port
 * @returns
 */
export function chromeRuntimePortEndpoint(port: chrome.runtime.Port): Endpoint {
    transferHandlers.set('proxy', proxyTransferHandler);

    const listeners = new WeakMap();
    return {
        start: () => {},

        postMessage: (message: any, _transfer: MessagePort[]) => {
            port.postMessage(message);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_EVENT_NAME) {
                throw new Error(MESSAGE_EVENT_ERROR);
            }

            const handler = (data: any, _port: chrome.runtime.Port) => {
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
            port.onMessage.addListener(handler);
            listeners.set(eventHandler, handler);
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_EVENT_NAME) {
                throw new Error(MESSAGE_EVENT_ERROR);
            }

            const handler = listeners.get(eventHandler);
            if (handler) {
                listeners.delete(eventHandler);
            }
        },
    };
}
