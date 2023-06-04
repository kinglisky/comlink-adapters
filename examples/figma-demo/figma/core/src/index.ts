import { expose } from 'comlink';
import { createFigmaCoreEndpoint } from 'comlink-adapters';
import { counter } from '@examples/counter';

figma.showUI(__html__);

figma.ui.onmessage = (msg) => {
    console.log('onmessage', msg);
};

expose(counter, createFigmaCoreEndpoint());
