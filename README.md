<h1 align="center">comlink-adapters</h1>

<div align="center">
不同应用平台的 comlink 适配器实现
</div>

## 介绍

> Comlink makes WebWorkers enjoyable. Comlink is a tiny library (1.1kB), that removes the mental barrier of thinking about postMessage and hides the fact that you are working with workers.

> At a more abstract level it is an RPC implementation for postMessage and ES6 Proxies.

[comlink](https://github.com/GoogleChromeLabs/comlink) 的核心实现基于 `postMessage` 和 [ES6 Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)，理论上在支持 `Proxy` 与类 `postMessage` 双向通信机制的 Javascript 环境中都可以实现一套 comlink 适配器，使之可以在 WebWorkers 之外的环境使用，适配器的实现可以参考 [node-adapter](https://github.com/GoogleChromeLabs/comlink/blob/main/src/node-adapter.ts)。


部分 comlink 的高级功能需要用到 [MessageChannel](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel) 创建与 [MessagePort](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort) 传递，有些平台的适配器可能无法支持，涉及的高级功能有：

- 使用 `new ProxyTarget()` 构造远程代理对象
- [Comlink.proxy](https://github.com/GoogleChromeLabs/comlink#comlinktransfervalue-transferables-and-comlinkproxyvalue)
- [Comlink.createEndpoint](https://github.com/GoogleChromeLabs/comlink#comlinkcreateendpoint)


目前实现的适配器如下：

- [x] [Electron](https://www.electronjs.org/)
- [x] [Figma](https://www.figma.com/plugin-docs/)
- [x] [Chrome extensions](https://developer.chrome.com/docs/extensions/)

欢迎提 [issues](https://github.com/kinglisky/comlink-adapters/issues) 或者一起新增其他应用平台的适配器。

## 指引

### 安装

```bash
# npm
npm i comlink comlink-adapters -S
# yarn
yarn add comlink comlink-adapters
# pnpm
pnpm add comlink comlink-adapters
```

### Electron Adapters

Adapters：
- `electronMainEndpoint` 用于创建主进程的 `Endpoint` 对象
- `electronRendererEndpoint` 用于渲染进程的 `Endpoint` 对象

Features:
| Feature | Support | Example | Description |
| :-----| :----- | :----- | :----- |
| set | ✅ | `await proxyObj.someValue;` | |
| get | ✅ | `await (proxyObj.someValue = xxx);` | |
| apply | ✅ | `await proxyObj.applySomeMethod();` | |
| construct | ✅ | `await new ProxyObj();` | |
| proxy function | ✅ | `await proxyObj.applySomeMethod(comlink.proxy(() => {}));` | |
| createEndpoint | ✅ | `proxyObj[comlink.createEndpoint]();`| 不建议使用 |
| release | ✅ | `proxyObj[comlink.releaseProxy]();`| |

createEndpoint 支持但不建议使用，内部实现使用 MessagePort 与 MessagePortMain 进行桥接，效率较差。

---

**electronMainEndpoint:**

```typescript
interface ElectronMainEndpointOptions {
    sender: WebContents;
    ipcMain: IpcMain;
    messageChannelConstructor: new () => MessageChannelMain;
    channelName?: string;
}

interface electronMainEndpoint {
  (options: ElectronMainEndpointOptions): Endpoint;
}
```
- **sender：** 与之通信的 renderer WebContents 对象。
- **ipcMain：** Electron 中的 IpcMain 对象。
- **messageChannelConstructor：** MessageChannel 的构造器，在主进程使用 MessageChannelMain。
- **channelName：** IPC channel 标识，默认为 `__COMLINK_MESSAGE_CHANNEL__`，可以通过 channelName 创建多对 comlink endpoint。

```typescript
// main.ts
import { ipcMain, MessageChannelMain } from 'electron';
import { expose } from 'comlink';
import { electronMainEndpoint } from 'comlink-adapters';

import type { WebContents, IpcMainEvent } from 'electron';

const add = (a: number, b: number) => a + b;

const senderWeakMap = new WeakMap<WebContents, boolean>();
const ackMessage = (sender: WebContents) => {
    sender.postMessage('init-comlink-endponit:ack', null);
};

ipcMain.on('init-comlink-endponit:syn', (event: IpcMainEvent) => {
    if (senderWeakMap.has(event.sender)) {
        ackMessage(event.sender);
        return;
    }

    // expose add function
    expose(
        add,
        electronMainEndpoint({
            ipcMain,
            messageChannelConstructor: MessageChannelMain,
            sender: event.sender,
        })
    );

    ackMessage(event.sender);
    senderWeakMap.set(event.sender, true);
});
```
---

**electronRendererEndpoint：** 

```typescript
interface ElectronRendererEndpointOptions {
    ipcRenderer: IpcRenderer;
    channelName?: string;
}

interface electronRendererEndpoint {
  (options: ElectronRendererEndpointOptions): Endpoint;
}
```

- **ipcRenderer：** Electron 中的 IpcRenderer 对象。
- **channelName：** IPC channel 标识。

```typescript
// renderer.ts
import { ipcRenderer } from 'electron';
import { wrap } from 'comlink';
import { electronRendererEndpoint } from 'comlink-adapters';

import type { Remote } from 'comlink';

type Add = (a: number, b: number) => number;

const useRemoteAdd = () => {
    return new Promise<Remote<Add>>((resolve) => {
        ipcRenderer.on('init-comlink-endponit:ack', () => {
            resolve(wrap<Add>(electronRendererEndpoint({ ipcRenderer })));
        });

        ipcRenderer.postMessage('init-comlink-endponit:syn', null);
    });
};

(async function() {
    const remoteAdd = await useRemoteAdd();
    const sum = await remoteAdd(1, 2);
    // output: 3
})();

```

---
### Figma Adapters

Adapters：
- `figmaCoreEndpoint` 用于创建 Figma 沙箱中主线程的 `Endpoint` 对象。
- `figmaUIEndpoint` 用于创建 Figma UI 进程的 `Endpoint` 对象。

Features:
| Feature | Support | Example | Description |
| :-----| :----- | :----- | :----- |
| set | ✅ | `await proxyObj.someValue;` | |
| get | ✅ | `await (proxyObj.someValue = xxx);` | |
| apply | ✅ | `await proxyObj.applySomeMethod();` | |
| construct | ❌ | `await new ProxyObj();` | Core 线程不支持 MessageChannel，Core 与 UI 线程无法传递 MessagePort |
| proxy function | ❌ | `await proxyObj.applySomeMethod(comlink.proxy(() => {}));` | 同上 |
| createEndpoint | ❌ | `proxyObj[comlink.createEndpoint]();`| 同上 |
| release | ✅ | `proxyObj[comlink.releaseProxy]();`| |


---
**figmaCoreEndpoint:**

```typescript
interface FigmaCoreEndpointOptions {
    origin?: string;
    checkProps?: (props: OnMessageProperties) => boolean | Promise<boolean>;
}

interface figmaCoreEndpoint {
    (params: FigmaCoreEndpointParams): Endpoint
}
```
- **origin:** [figma.ui.postMessage](https://www.figma.com/plugin-docs/api/properties/figma-ui-postmessage) 的 `origin` 配置。
- **checkProps:** 用于检查 [ figma.ui.on('message', (msg, props) => {})](https://www.figma.com/plugin-docs/api/properties/figma-ui-on) 返回 `props` 中的 `origin` 来源。

```typescript
// core.ts
import { expose } from 'comlink';
import { figmaCoreEndpoint } from 'comlink-adapters';

expose((a: number, b: number) => a + b, figmaCoreEndpoint());
```

---
**figmaUIEndpoint:**

```typescript
interface FigmaUIEndpointOptions {
    origin?: string;
}

interface figmaUIEndpoint {
    (params: FigmaUIEndpointOptions): Endpoint
}
```
- **origin:** UI iframe 中 [window:postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) 的 `targetOrigin` 配置，默认为 `*`

```typescript
// ui.ts
import { wrap } from 'comlink';
import { figmaUIEndpoint } from 'comlink-adapters';

const add = wrap<(a: number, b: number) => number>(figmaUIEndpoint());

(async function() {
    const sum = await add(1, 2);
    // output: 3
})();
```
---

### Chrome Extensions Adapters

TODO