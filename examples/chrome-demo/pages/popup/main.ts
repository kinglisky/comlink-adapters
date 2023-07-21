import {
    chromeRuntimePortEndpoint,
    chromeRuntimeMessageEndpoint,
} from 'comlink-adapters';
import { wrapCounter } from '@examples/test';

import './style.css';

function setupTestCounter(options: {
    portTestButton: HTMLButtonElement;
    messageTestButton: HTMLButtonElement;
    output: HTMLPreElement;
}) {
    const { portTestButton, messageTestButton, output } = options;

    const startPortEndpointTest = async () => {
        const port = chrome.runtime.connect({
            name: 'popup-to-background',
        });

        const testCounter = wrapCounter(chromeRuntimePortEndpoint(port));

        output.innerHTML = 'Test Counter Cases:';
        const result = await testCounter(output);
        console.log('startPortEndpointTest', result);
    };

    portTestButton.addEventListener('click', () => startPortEndpointTest());

    const startMessageEndpointTest = async () => {
        await chrome.runtime.sendMessage(
            'chromeRuntimeMessageEndpoint popup call background'
        );
        const testCounter = wrapCounter(chromeRuntimeMessageEndpoint());
        output.innerHTML = 'Test Counter Cases:';
        const result = await testCounter(output);
        console.log('startMessageEndpointTest', result);
    };
    messageTestButton.addEventListener('click', () =>
        startMessageEndpointTest()
    );
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <pre id="message">Test Counter Cases:</pre>
    <button id="test-port-button" type="button">Test port endpoint</button>
    <button id="test-message-button" type="button">Test message endpoint</button>
  </div>
`;

setupTestCounter({
    portTestButton:
        document.querySelector<HTMLButtonElement>('#test-port-button')!,
    messageTestButton: document.querySelector<HTMLButtonElement>(
        '#test-message-button'
    )!,
    output: document.querySelector<HTMLPreElement>('#message')!,
});
