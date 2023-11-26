import { nodeProcessEndpoint } from 'comlink-adapters';
import { exposeCounter } from '@examples/test-case';

exposeCounter(nodeProcessEndpoint({ nodeProcess: process }));
