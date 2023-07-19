import {
    expose,
    wrap,
    proxy,
    proxyMarker,
    createEndpoint,
    releaseProxy,
} from 'comlink';
import { expect } from 'chai';

import type { Endpoint } from 'comlink';

export class Counter {
    [proxyMarker]: true;

    constructor(public count = 0) {
        this[proxyMarker] = true;
    }

    add() {
        this.count += 1;
    }

    subtract() {
        this.count -= 1;
    }

    use(handler: (count: number) => void) {
        handler(this.count);
    }
}

export const counter = new Counter();

const exposeContent = {
    counterInstance: counter,
    counterConstructor: Counter,
};

export const exposeCounter = (endpoint: Endpoint) => {
    expose(exposeContent, endpoint);
};

export const wrapCounter = (endpoint: Endpoint) => {
    const remoteContent = wrap<typeof exposeContent>(endpoint);
    const testCases = [
        {
            message: 'GET:',
            case: async () => {
                const res = await remoteContent.counterInstance.count;
                expect(res).to.equal(0);
            },
        },
        {
            message: 'SET:',
            case: async () => {
                // @ts-ignore
                await (remoteContent.counterInstance.count = 1);
                const v1 = await remoteContent.counterInstance.count;
                expect(v1).to.equal(1);
                // @ts-ignore
                await (remoteContent.counterInstance.count = 0);
                const v2 = await remoteContent.counterInstance.count;
                expect(v2).to.equal(0);
            },
        },
        {
            message: 'APPLY:',
            case: async () => {
                await remoteContent.counterInstance.add();
                const v1 = await remoteContent.counterInstance.count;
                expect(v1).to.equal(1);
                await remoteContent.counterInstance.subtract();
                const v2 = await remoteContent.counterInstance.count;
                expect(v2).to.equal(0);
            },
        },
        {
            message: 'CONSTRUCT:',
            case: async () => {
                const counterInstance =
                    await new remoteContent.counterConstructor();
                const value = await counterInstance.count;
                expect(value).to.equal(0);
            },
        },
        {
            message: 'PROXY FUNCTION:',
            case: async () => {
                await remoteContent.counterInstance.use(
                    proxy((count) => {
                        expect(count).to.equal(0);
                    })
                );
            },
        },
        {
            message: 'ENDPOINT:',
            case: async () => {
                const port = await remoteContent[createEndpoint]();
                if (port instanceof MessagePort) {
                    const newContent = wrap<typeof exposeContent>(port);
                    await newContent.counterInstance.add();
                    await newContent.counterInstance.subtract();
                    const count = await newContent.counterInstance.count;
                    expect(count).to.equal(0);
                } else {
                    throw new Error(
                        'createEndpoint return value is not MessagePort'
                    );
                }
            },
        },
        {
            message: 'RELEASE:',
            case: async () => {
                remoteContent[releaseProxy]();
                let msg = '';
                try {
                    await remoteContent.counterInstance.count;
                } catch (error) {
                    msg = (error && Reflect.get(error, 'message')) || '';
                }
                expect(msg).to.equal(
                    'Proxy has been released and is not useable'
                );
            },
        },
    ];

    return async (output?: HTMLPreElement) => {
        const message = await testCases.reduce(async (lastCateInfo, item) => {
            const msg = await lastCateInfo;
            const res = await item
                .case()
                .then(() => 'success')
                .catch((error) => {
                    console.error(item.message, error.message);
                    return `failure(${error.message || ''})`;
                });

            const info = `${msg}\n${item.message} ${res}`;
            if (output) {
                output.innerHTML = info;
            }

            return info;
        }, Promise.resolve(output?.innerHTML || ''));
        return message;
    };
};
