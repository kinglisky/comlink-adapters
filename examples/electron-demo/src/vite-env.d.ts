/// <reference types="vite/client" />

declare interface Window {
    testCounter: (output: HTMLPreElement) => Promise<string>;
}
