import {
    chromeRuntimePortEndpoint,
    chromeRuntimeMessageEndpoint,
} from 'comlink-adapters';
import { exposeCounter } from '@examples/test-case';

import { EXT_A_ID } from './constant';

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('B chrome.runtime.onInstalled', details);
    chrome.runtime.sendMessage(EXT_A_ID, 'ext b init');
});

chrome.runtime.onConnectExternal.addListener((port) => {
    if (
        port.name === 'content connect external background' ||
        port.name === 'background connect external background'
    ) {
        exposeCounter(chromeRuntimePortEndpoint(port));
        return;
    }
});

chrome.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse) => {
        if (
            message ===
            'chromeRuntimeMessageEndpoint background call external background'
        ) {
            exposeCounter(
                chromeRuntimeMessageEndpoint({
                    extensionId: sender.id,
                })
            );
            sendResponse();
            return;
        }

        sendResponse();
        return;
    }
);
