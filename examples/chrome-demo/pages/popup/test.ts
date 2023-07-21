import { chromeRuntimePortEndpoint } from 'comlink-adapters';
import { wrapCounter } from '@examples/test';

export function setupTestCounter(
    button: HTMLButtonElement,
    output: HTMLPreElement
) {
    const port = chrome.runtime.connect({
        name: 'popup-to-background',
    });

    const testCounter = wrapCounter(chromeRuntimePortEndpoint(port));

    const startTestCounter = async () => {
        output.innerHTML = 'Test Counter Cases:';
        const result = await testCounter(output);
        console.log('startTestCounter', result);
    };

    button.addEventListener('click', () => startTestCounter());
    chrome.runtime.sendMessage('from popup page');
}
