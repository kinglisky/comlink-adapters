import { figmaUIEndpoint } from 'comlink-adapters';
import { wrapCounter } from '@examples/test-case';

export function setupTestCounter(
    button: HTMLButtonElement,
    output: HTMLPreElement
) {
    const testCounter = wrapCounter(figmaUIEndpoint());

    const startTestCounter = async () => {
        output.innerHTML = 'Test Counter Cases:';
        const result = await testCounter(output);
        console.log('startTestCounter', result);
    };

    button.addEventListener('click', () => startTestCounter());
}
