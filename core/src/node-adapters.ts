import {
    wrap,
    expose,
    proxyMarker,
    ProxyMarked,
    transferHandlers,
} from 'comlink';
import { isObject, generateUUID } from './utils';
import { MESSAGE_CHANNEL_NAME, PROXY_MESSAGE_CHANNEL_MARKER } from './constant';

import type { ChildProcess } from 'node:child_process';
import type { Endpoint, TransferHandler } from 'comlink';

const nodeProcessTransferHandlers: WeakMap<
    ChildProcess | NodeJS.Process,
    TransferHandler<unknown, unknown>
> = new Map();

const createProxyTransferHandler = (
    nodeProcess: ChildProcess | NodeJS.Process
) => {
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
                nodeProcessEndpoint({
                    nodeProcess,
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
                nodeProcessEndpoint({
                    nodeProcess,
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
 * init node process transferHandlers
 * @param messageChannelConstructor
 */
const initTransferHandlers = (nodeProcess: ChildProcess | NodeJS.Process) => {
    if (!nodeProcessTransferHandlers.has(nodeProcess)) {
        nodeProcessTransferHandlers.set(
            nodeProcess,
            createProxyTransferHandler(nodeProcess)
        );

        const cleanup = () => {
            if (nodeProcessTransferHandlers.has(nodeProcess)) {
                nodeProcessTransferHandlers.delete(nodeProcess);
            }
        };
        process.on('exit', cleanup);
        process.on('disconnect', cleanup);
        process.on('SIGINT', cleanup);
        process.on('uncaughtException', cleanup);
    }

    transferHandlers.set(
        'proxy',
        nodeProcessTransferHandlers.get(nodeProcess)!
    );
};

export function nodeProcessEndpoint(options: {
    nodeProcess: ChildProcess | NodeJS.Process;
    messageChannel?: string;
}): Endpoint {
    const { nodeProcess, messageChannel } = options;
    const listeners = new WeakMap();
    const channel = messageChannel || MESSAGE_CHANNEL_NAME;

    initTransferHandlers(nodeProcess);

    return {
        postMessage: (message: any, _transfer?: Transferable[]) => {
            if (!nodeProcess.send) return;
            nodeProcess.send({ message, __channel__: channel });
        },

        addEventListener: (_, eh) => {
            const listener = (data: any) => {
                if (
                    !data ||
                    !data.__channel__ ||
                    !data.message ||
                    data.__channel__ !== channel
                ) {
                    return;
                }

                const { message } = data;

                if ('handleEvent' in eh) {
                    eh.handleEvent({ data: message } as MessageEvent);
                } else {
                    eh({ data: message } as MessageEvent);
                }
            };
            nodeProcess.on('message', listener);
            listeners.set(eh, listener);
        },

        removeEventListener: (_, eh) => {
            const listener = listeners.get(eh);
            if (!listener) {
                return;
            }
            nodeProcess.off('message', listener);
            listeners.delete(eh);
        },

        start: () => {},
    };
}
