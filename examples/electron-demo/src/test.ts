export function setupTestCounter(
    button: HTMLButtonElement,
    output: HTMLPreElement
) {
    const startTestCounter = async () => {
        output.innerHTML = 'Test Counter Cases:';
        const result = await window.testCounter(output);
        console.log('startTestCounter', result);
    };

    button.addEventListener('click', () => startTestCounter());
}
