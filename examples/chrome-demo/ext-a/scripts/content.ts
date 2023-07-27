import {
    chromeRuntimePortEndpoint,
    chromeRuntimeMessageEndpoint,
} from 'comlink-adapters';
import { wrapCounter, exposeCounter } from '@examples/test';
import { OTHER_EXITENSION_ID } from './constant';

const log = (msg: string) => {
    console.log(msg);
    // alert(msg);
};

(async function () {
    const desc = 'chromeRuntimePortEndpoint content call background';
    const port = chrome.runtime.connect({
        name: 'content connect background',
    });
    const testCounter = wrapCounter(chromeRuntimePortEndpoint(port));
    const info = await testCounter();
    log(`${desc}:${info}`);
})();

(async function () {
    const desc = `chromeRuntimePortEndpoint content call ext background`;
    const port = chrome.runtime.connect(OTHER_EXITENSION_ID, {
        name: 'background connect external background',
    });
    const testCounter = wrapCounter(chromeRuntimePortEndpoint(port));
    const info = await testCounter();
    log(`${desc}:${info}`);
})();

(async function () {
    const desc = 'chromeRuntimePortEndpoint background call content';
    chrome.runtime.onConnect.addListener((port) => {
        exposeCounter(chromeRuntimePortEndpoint(port));
    });
    const info = await chrome.runtime.sendMessage(desc);
    log(`${desc}:${info}`);
})();

(async function () {
    const desc = 'chromeRuntimeMessageEndpoint content call background';
    await chrome.runtime.sendMessage(desc);
    const testCounter = wrapCounter(chromeRuntimeMessageEndpoint());
    const info = await testCounter();
    log(`${desc}:${info}`);
})();

(async function () {
    const desc = 'chromeRuntimeMessageEndpoint content call ext background';
    await chrome.runtime.sendMessage(OTHER_EXITENSION_ID, desc);
    const testCounter = wrapCounter(chromeRuntimeMessageEndpoint());
    const info = await testCounter();
    log(`${desc}:${info}`);
})();

(async function () {
    const desc = 'chromeRuntimeMessageEndpoint background call content';
    exposeCounter(chromeRuntimeMessageEndpoint());
    const info = await chrome.runtime.sendMessage(desc);
    log(`${desc}:${info}`);
})();
