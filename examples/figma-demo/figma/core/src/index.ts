import { figmaCoreEndpoint } from 'comlink-adapters';
import { exposeCounter } from '@examples/test';

figma.showUI(__html__);

figma.ui.onmessage = (msg) => {
    console.log('onmessage', msg);
};

exposeCounter(figmaCoreEndpoint());
