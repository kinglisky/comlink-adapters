import { fork } from 'node:child_process';
import { nodeProcessEndpoint } from 'comlink-adapters';
import { wrapCounter } from '@examples/test-case';

import type { ChildProcess } from 'node:child_process';

(async function () {
    const childProcess: ChildProcess = fork('child.ts');
    const clean = () => {
        childProcess.kill();
        process.exit(0);
    };
    process.on('exit', clean);
    process.on('disconnect', clean);
    process.on('SIGINT', clean);
    process.on('uncaughtException', clean);

    const testCounter = wrapCounter(
        nodeProcessEndpoint({ nodeProcess: childProcess })
    );
    const result = await testCounter();
    console.log('TestCounter Result', result);
    clean();
})();
