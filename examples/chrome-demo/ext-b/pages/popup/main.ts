import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <pre id="message">Test Counter Cases:</pre>
    <button id="test-port-button" type="button">Test port endpoint</button>
    <button id="test-message-button" type="button">Test message endpoint</button>
  </div>
`;
