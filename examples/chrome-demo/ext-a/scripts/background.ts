import {
    chromeRuntimePortEndpoint,
    chromeRuntimeMessageEndpoint,
} from 'comlink-adapters';
import { exposeCounter, wrapCounter } from '@examples/test';

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('A chrome.runtime.onInstalled', details);
});

chrome.runtime.onStartup.addListener(() => {
    console.log('chrome.runtime.onStartup');
});

chrome.runtime.onConnect.addListener(function (port) {
    console.log('chrome.runtime.onConnect', port.name, port);
    if (port.name === 'content connect background') {
        console.log('background expose content chromeRuntimePortEndpoint');
        exposeCounter(chromeRuntimePortEndpoint(port));
    }

    if (port.name === 'popup connect background') {
        console.log('background expose popup chromeRuntimePortEndpoint');
        exposeCounter(chromeRuntimePortEndpoint(port));
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message === 'chromeRuntimeMessageEndpoint content call background') {
        exposeCounter(chromeRuntimeMessageEndpoint({ tabId: sender.tab?.id }));
        sendResponse();
        return true;
    }

    if (message === 'chromeRuntimeMessageEndpoint background call content') {
        const testCounter = wrapCounter(
            chromeRuntimeMessageEndpoint({ tabId: sender.tab?.id })
        );
        testCounter().then((info) => {
            console.log(
                'chromeRuntimeMessageEndpoint background call content:',
                info
            );
            sendResponse(info);
        });
        return true;
    }

    if (message === 'chromeRuntimeMessageEndpoint popup call background') {
        exposeCounter(chromeRuntimeMessageEndpoint());
        sendResponse();
        return true;
    }

    if (message === 'chromeRuntimePortEndpoint background call content') {
        chrome.tabs
            .query({
                active: true,
            })
            .then(([tab]) => {
                if (tab) {
                    const port = chrome.tabs.connect(tab.id!, {
                        name: 'background-to-content',
                    });
                    const testCounter = wrapCounter(
                        chromeRuntimePortEndpoint(port)
                    );
                    testCounter().then((info) => {
                        console.log(
                            'chromeRuntimePortEndpoint background call content:',
                            info
                        );
                        sendResponse(info);
                    });
                } else {
                    sendResponse('active tab not found');
                }
            });
        return true;
    }

    sendResponse();
    return true;
});

chrome.runtime.onMessageExternal.addListener(async (message, sender) => {
    if (message !== 'ext b init') return;
    console.log('ext b init', sender);

    const port = chrome.runtime.connect(sender.id!, {
        name: 'background connect external background',
    });
    let testCounter = wrapCounter(chromeRuntimePortEndpoint(port));
    let info = await testCounter();
    console.log('chromeRuntimePortEndpoint external testCounter info', info);

    const desc = 'chromeRuntimeMessageEndpoint background call ext background';
    chrome.runtime.sendMessage(sender.id!, desc);
    testCounter = wrapCounter(
        chromeRuntimeMessageEndpoint({ extensionId: sender.id! })
    );
    info = await testCounter();
    console.log(desc, info);
});
