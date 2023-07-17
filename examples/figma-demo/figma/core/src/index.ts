import { figmaCoreEndpoint } from 'comlink-adapters';
import { exposeCounter } from '@examples/test';

figma.showUI(__html__, { width: 600, height: 400 });

exposeCounter(figmaCoreEndpoint());
