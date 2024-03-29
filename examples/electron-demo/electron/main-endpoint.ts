import { ipcMain, MessageChannelMain } from 'electron';
import { electronMainEndpoint } from 'comlink-adapters';
import { exposeCounter } from '@examples/test-case';

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
        exposeCounter(
            electronMainEndpoint({
                ipcMain,
                messageChannelConstructor: MessageChannelMain,
                sender: event.sender,
            })
        );

        ackMessage(event.sender);
        senderWeakMap.set(event.sender, true);
    });
};
