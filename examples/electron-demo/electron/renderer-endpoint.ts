import { ipcRenderer } from 'electron';
import { electronRendererEndpoint } from 'comlink-adapters';
import { wrapCounter } from '@examples/test';

export const useRendererCounter = () => {
    return new Promise<(output: HTMLPreElement) => Promise<string>>(
        (resolve) => {
            ipcRenderer.on('init-comlink-endponit:ack', () => {
                resolve(wrapCounter(electronRendererEndpoint({ ipcRenderer })));
            });
            ipcRenderer.postMessage('init-comlink-endponit:syn', null);
        }
    );
};
