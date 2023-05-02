import { ipcMain } from 'electron';
import { expose } from 'comlink';
import { createMainEndpoint } from 'comlink-adapters';
import { counter } from '@examples/counter';

import type { WebContents, IpcMainEvent } from 'electron';

export const registerMainCounter = () => {
    const senderWeakMap = new WeakMap<WebContents, boolean>();
    const ackMessage = (sender: WebContents) => {
        sender.postMessage('init-comlink-endponit:ack', null);
    };
    ipcMain.on('init-comlink-endponit:syn', (event: IpcMainEvent) => {
        if (senderWeakMap.has(event.sender)) {
            ackMessage(event.sender);
            return;
        }

        // expose counter
        expose(
            counter,
            createMainEndpoint({
                sender: event.sender,
            })
        );
        ackMessage(event.sender);
        senderWeakMap.set(event.sender, true);
    });
};
