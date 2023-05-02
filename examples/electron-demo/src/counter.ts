import type { Counter } from '@examples/counter';

export function setupRendererCounter(element: HTMLButtonElement) {
    const rendererCounter = window.rendererCounter as Counter;

    const setCounter = async () => {
        await rendererCounter.add();
        const count = await rendererCounter.count;
        element.innerHTML = `count is ${count}`;
    };
    element.addEventListener('click', () => setCounter());
    setCounter();
}
