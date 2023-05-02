import { ipcRenderer } from 'electron';
import { wrap } from 'comlink';
import { createRendererEndpoint } from 'comlink-adapters';

import type { Remote } from 'comlink';
import type { Counter } from '@examples/counter';

export const useRendererCounter = () => {
    return new Promise<Remote<Counter>>((resolve) => {
        ipcRenderer.on('init-comlink-endponit:ack', () => {
            const remoteCounter = wrap<Counter>(createRendererEndpoint());
            resolve(remoteCounter);
        });
        ipcRenderer.postMessage('init-comlink-endponit:syn', null);
    });
};
