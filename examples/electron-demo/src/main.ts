import { setupRendererCounter } from './counter';
import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="demo">
    <h1>Renderer Counter</h1>
    <button id="renderer-counter" type="button"></button>
  </div>
`;

setupRendererCounter(
    document.querySelector<HTMLButtonElement>('#renderer-counter')!
);

postMessage({ payload: 'removeLoading' }, '*');
