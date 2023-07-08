import { setupTestCounter } from './test';
import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="demo">
    <pre id="message">Test Counter Cases:</pre>
    <button id="renderer-counter" type="button">TEST Counter</button>
  </div>
`;

setupTestCounter(
    document.querySelector<HTMLButtonElement>('#renderer-counter')!,
    document.querySelector<HTMLPreElement>('#message')!
);

postMessage({ payload: 'removeLoading' }, '*');
