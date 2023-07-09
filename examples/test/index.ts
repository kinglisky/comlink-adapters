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

export const enum MessageType {
    GET = 'GET',
    SET = 'SET',
    APPLY = 'APPLY',
    CONSTRUCT = 'CONSTRUCT',
    ENDPOINT = 'ENDPOINT',
    RELEASE = 'RELEASE',
}

export const wrapCounter = (endpoint: Endpoint) => {
    const remoteContent = wrap<typeof exposeContent>(endpoint);
    const testCases = [
        // {
        //     message: 'Whether to support GET:',
        //     case: async () => {
        //         const res = await remoteContent.counterInstance.count;
        //         expect(res).to.equal(0);
        //     },
        // },
        // {
        //     message: 'Whether to support SET:',
        //     case: async () => {
        //         // @ts-ignore
        //         await (remoteContent.counterInstance.count = 1);
        //         const v1 = await remoteContent.counterInstance.count;
        //         expect(v1).to.equal(1);

        //         // @ts-ignore
        //         await (remoteContent.counterInstance.count = 0);
        //         const v2 = await remoteContent.counterInstance.count;
        //         expect(v2).to.equal(0);
        //     },
        // },
        // {
        //     message: 'Whether to support APPLY:',
        //     case: async () => {
        //         await remoteContent.counterInstance.add();
        //         const v1 = await remoteContent.counterInstance.count;
        //         expect(v1).to.equal(1);

        //         await remoteContent.counterInstance.subtract();
        //         const v2 = await remoteContent.counterInstance.count;
        //         expect(v2).to.equal(0);
        //     },
        // },
        // {
        //     message: 'Whether to support CONSTRUCT:',
        //     case: async () => {
        //         const counterInstance =
        //             await new remoteContent.counterConstructor();

        //         const value = await counterInstance.count;
        //         expect(value).to.equal(0);
        //     },
        // },
        {
            message: 'Whether to support proxy function:',
            case: async () => {
                await remoteContent.counterInstance.add();
                await remoteContent.counterInstance.use(
                    proxy((count) => {
                        expect(count).to.equal(1);
                    })
                );

                await remoteContent.counterInstance.subtract();
                await remoteContent.counterInstance.use(
                    proxy((count) => {
                        expect(count).to.equal(0);
                    })
                );
            },
        },
        // {
        //     message: 'Whether to support ENDPOINT:',
        //     case: async () => {
        //         const port = await remoteContent[createEndpoint]();
        //         const newContent = wrap<typeof exposeContent>(port);
        //         await newContent.counterInstance.add();
        //         await newContent.counterInstance.subtract();
        //         const count = await newContent.counterInstance.count;
        //         expect(count).to.equal(0);
        //     },
        // },
        // {
        //     message: 'Whether to support RELEASE:',
        //     case: async () => {
        //         remoteContent[releaseProxy]();

        //         let msg = '';
        //         try {
        //             await remoteContent.counterInstance.count;
        //         } catch (error) {
        //             msg = error.message;
        //         }

        //         expect(msg).to.equal(
        //             'Proxy has been released and is not useable'
        //         );
        //     },
        // },
    ];
    return async (output: HTMLPreElement) => {
        const message = await testCases.reduce(async (lastCateInfo, item) => {
            const msg = await lastCateInfo;
            const res = await item
                .case()
                .then(() => 'ok')
                .catch((error) => {
                    console.error(item.message, error.message);
                    return error.message || '';
                });
            output.innerHTML = `${msg}\n${item.message} ---> ${res}`;
            return output.innerHTML;
        }, Promise.resolve(output.innerHTML));
        return message;
    };
};
