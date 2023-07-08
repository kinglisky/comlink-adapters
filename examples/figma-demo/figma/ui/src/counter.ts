import { wrap } from 'comlink';
import { figmaUIEndpoint } from 'comlink-adapters';

import type { Counter } from '@examples/test';

export function setupCounter(eles: {
    add: HTMLButtonElement;
    count: HTMLParagraphElement;
}) {
    const remoteCounter = wrap<Counter>(figmaUIEndpoint());
    eles.add.addEventListener('click', async () => {
        await remoteCounter.add();
        const value = await remoteCounter.count;
        eles.count.innerText = `count: ${value}`;
    });
}
