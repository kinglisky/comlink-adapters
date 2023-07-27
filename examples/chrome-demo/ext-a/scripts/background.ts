import {
    chromeRuntimePortEndpoint,
    chromeRuntimeMessageEndpoint,
} from 'comlink-adapters';
import { exposeCounter, wrapCounter } from '@examples/test';
import { OTHER_EXITENSION_ID } from './constant';

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('chrome.runtime.onInstalled', details);

    const port = chrome.runtime.connect(OTHER_EXITENSION_ID, {
        name: 'background connect external background',
    });
    let testCounter = wrapCounter(chromeRuntimePortEndpoint(port));
    let info = await testCounter();
    console.log('chromeRuntimePortEndpoint external testCounter info', info);

    const desc = 'chromeRuntimeMessageEndpoint background call ext background';
    const res = await chrome.runtime.sendMessage(OTHER_EXITENSION_ID, desc);
    console.log(res);
    testCounter = wrapCounter(
        chromeRuntimeMessageEndpoint({ extensionId: OTHER_EXITENSION_ID })
    );
    info = await testCounter();
    console.log(desc, info);
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
