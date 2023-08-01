import {
    chromeRuntimePortEndpoint,
    chromeRuntimeMessageEndpoint,
} from 'comlink-adapters';
import { exposeCounter } from '@examples/test';

import { EXT_A_ID } from './constant';

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('B chrome.runtime.onInstalled', details, EXT_A_ID);
    chrome.runtime.sendMessage(EXT_A_ID, 'ext b init');
});

chrome.runtime.onConnectExternal.addListener((port) => {
    if (port.name === 'background connect external background') {
        exposeCounter(chromeRuntimePortEndpoint(port));
        return;
    }
});

chrome.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse) => {
        if (
            message ===
            'chromeRuntimeMessageEndpoint content call external background'
        ) {
            exposeCounter(
                chromeRuntimeMessageEndpoint({
                    listenExternalMessage: true,
                    tabId: sender.tab?.id,
                })
            );
            sendResponse();
            return true;
        }

        if (
            message ===
            'chromeRuntimeMessageEndpoint background call external background'
        ) {
            exposeCounter(
                chromeRuntimeMessageEndpoint({
                    listenExternalMessage: true,
                    extensionId: sender.id,
                })
            );
            sendResponse();
            return true;
        }

        sendResponse();
        return true;
    }
);
