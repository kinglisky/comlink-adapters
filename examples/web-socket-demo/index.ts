import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

(async function () {
    const childProcessList: ChildProcess[] = [];
    const execute = (processPath: string) => {
        return new Promise<void>((resolve, reject) => {
            const childProcess = fork(processPath);
            childProcessList.push(childProcess);
            childProcess.on('message', (message) => {
                if (message === 'ready') {
                    console.log(`${processPath} is ready`);
                    resolve();
                }
            });
            childProcess.on('error', (err) => {
                reject(err);
            });
        });
    };
    const childProcessTask = ['server.ts', 'client.ts'].reduce(
        (promise, processPath) => {
            return promise.then(() => execute(processPath));
        },
        Promise.resolve(),
    );

    await childProcessTask;

    const clean = () => {
        console.log('cleaning up');
        childProcessList.forEach((childProcess) => {
            childProcess.kill();
        })
        process.exit(0);
      };
    
      process.on('exit', clean);
      process.on('disconnect', clean);
      process.on('SIGINT', clean);
      process.on('uncaughtException', clean);
})();
