import { expose } from 'comlink';
import { figmaCoreEndpoint } from 'comlink-adapters';
import { counter } from '@examples/test';

figma.showUI(__html__);

figma.ui.onmessage = (msg) => {
    console.log('onmessage', msg);
};

expose(counter, figmaCoreEndpoint());
