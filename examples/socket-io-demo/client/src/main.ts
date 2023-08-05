import { setupTestCounter } from './test.ts';
import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <pre id="message">Test Counter Cases:</pre>
    <button id="test-button" type="button">TEST Counter</button>
  </div>
`;

setupTestCounter(
    document.querySelector<HTMLButtonElement>('#test-button')!,
    document.querySelector<HTMLPreElement>('#message')!
);
