import { MESSAGE_NAME } from './constant';

import type { Endpoint } from 'comlink';

/**
 * create figma ui endpoint
 * @param options
 * @returns
 */
export function figmaUIEndpoint(options?: { origin?: string }): Endpoint {
    const listeners = new WeakMap();
    return {
        postMessage: (message: any, transfer: MessagePort[]) => {
            globalThis.parent.postMessage(
                {
                    pluginMessage: message,
                },
                {
                    targetOrigin: options?.origin || '*',
                    transfer,
                }
            );
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = (event: MessageEvent) => {
                const { ports, data } = event;
                if ('handleEvent' in eventHandler) {
                    eventHandler.handleEvent({
                        data: data.pluginMessage,
                        ports,
                    } as unknown as MessageEvent);
                } else {
                    eventHandler({
                        data: data.pluginMessage,
                        ports,
                    } as unknown as MessageEvent);
                }
            };

            globalThis.addEventListener(MESSAGE_NAME, handler);
            listeners.set(eventHandler, handler);
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = listeners.get(eventHandler);
            if (handler) {
                globalThis.removeEventListener(MESSAGE_NAME, handler);
                listeners.delete(eventHandler);
            }
        },
    };
}

/**
 * create figma core endpoint
 * @param options
 * @returns
 */
export function figmaCoreEndpoint(options?: {
    origin?: string;
    checkProps?: (props: OnMessageProperties) => boolean | Promise<boolean>;
}): Endpoint {
    const listeners = new WeakMap();
    return {
        // not supported transfer
        postMessage: (message: any) => {
            figma.ui.postMessage(message, { origin: options?.origin || '*' });
        },

        addEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = async (data: any, props: OnMessageProperties) => {
                // check props
                const result = options?.checkProps
                    ? await options?.checkProps(props)
                    : true;
                if (!result) return;

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

            figma.ui.on(MESSAGE_NAME, handler);
            listeners.set(eventHandler, handler);
        },

        removeEventListener: (eventName, eventHandler) => {
            if (eventName !== MESSAGE_NAME) return;

            const handler = listeners.get(eventHandler);
            if (handler) {
                figma.ui.off(MESSAGE_NAME, handler);
                listeners.delete(eventHandler);
            }
        },
    };
}
