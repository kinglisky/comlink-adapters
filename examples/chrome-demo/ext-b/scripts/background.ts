import {
    chromeRuntimePortEndpoint,
    chromeRuntimeMessageEndpoint,
} from 'comlink-adapters';
import { exposeCounter, wrapCounter } from '@examples/test';

console.log('init background');

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
            'chromeRuntimeMessageEndpoint content call ext background'
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
            'chromeRuntimeMessageEndpoint background call ext background'
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
