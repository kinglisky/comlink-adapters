import './style.css';
import { setupCounter } from './counter.ts';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h2>core counter</h2>
    <p id="count"></p>
    <button id="add">Add</button>
  </div>
`;

setupCounter({
    add: document.querySelector<HTMLButtonElement>('#add')!,
    count: document.querySelector<HTMLParagraphElement>('#count')!,
});
