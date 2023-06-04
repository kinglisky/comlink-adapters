import { wrap } from 'comlink';
import { createFigmaUIEndpoint } from 'comlink-adapters';

import type { Counter } from '@examples/counter';

export function setupCounter(eles: {
    add: HTMLButtonElement;
    count: HTMLParagraphElement;
}) {
    const remoteCounter = wrap<Counter>(createFigmaUIEndpoint());
    eles.add.addEventListener('click', async () => {
        await remoteCounter.add();
        const value = await remoteCounter.count;
        eles.count.innerText = `count: ${value}`;
    });
}
