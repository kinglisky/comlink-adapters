import {
    chromeRuntimePortEndpoint,
    chromeRuntimeMessageEndpoint,
} from 'comlink-adapters';
import { exposeCounter, wrapCounter } from '@examples/test';

console.log('init background');

chrome.runtime.onConnectExternal.addListener((port) => {
    console.log('chrome.runtime.onConnectExternal', port);
    if (port.name === 'background connect external background') {
        exposeCounter(chromeRuntimePortEndpoint(port));
        return;
    }
});

chrome.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse) => {
        console.log('chrome.runtime.onMessageExternal.addListener', {
            message,
            sender,
            sendResponse,
        });
        sendResponse('ok');
    }
);
