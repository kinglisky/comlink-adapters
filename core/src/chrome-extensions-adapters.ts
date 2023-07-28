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
 * create chrome runtime port endpoint(Long-lived connections)
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

/**
 * create chrome runtime message endpoint(Simple one-time requests)
 * https://developer.chrome.com/docs/extensions/mv3/messaging/#simple
 * @param options
 * @returns
 */
export function chromeRuntimeMessageEndpoint(options?: {
    tabId?: number;
    extensionId?: string;
    listenExternalMessage?: boolean;
}): Endpoint {
    const {
        tabId = 0,
        extensionId = '',
        listenExternalMessage = false,
    } = options || {};

    transferHandlers.set('proxy', proxyTransferHandler);

    const listeners = new Set<EventListenerOrEventListenerObject>();

    const handleMessageListener = (
        data: any,
        _sender: chrome.runtime.MessageSender,
        _sendResponse: (response?: any) => void
    ) => {
        if (!data || !listeners.size) return;

        for (const eventHandler of listeners.values()) {
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
        }
    };

    if (listenExternalMessage) {
        chrome.runtime.onMessageExternal.addListener(handleMessageListener);
    } else {
        chrome.runtime.onMessage.addListener(handleMessageListener);
    }

    return {
        start: () => {},

        postMessage: (message: any, _transfer: MessagePort[]) => {
            // send to tab
            if (tabId) {
                chrome.tabs.sendMessage(tabId, message);
                return;
            }

            // send to other extension
            if (extensionId) {
                chrome.runtime.sendMessage(extensionId, message);
                return;
            }

            // send self
            chrome.runtime.sendMessage(message);
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_EVENT_NAME) {
                throw new Error(MESSAGE_EVENT_ERROR);
            }
            listeners.add(eventHandler);
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_EVENT_NAME) {
                throw new Error(MESSAGE_EVENT_ERROR);
            }

            if (listeners.has(eventHandler)) {
                listeners.delete(eventHandler);
            }
        },
    };
}
