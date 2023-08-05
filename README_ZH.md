<h1 align="center">comlink-adapters</h1>

<div align="center">
不同应用平台的 comlink 适配器实现

[English](README.md) &nbsp;&nbsp;|&nbsp;&nbsp; [简体中文](README_ZH.md)

</div>

## 介绍

> Comlink makes WebWorkers enjoyable. Comlink is a tiny library (1.1kB), that removes the mental barrier of thinking about postMessage and hides the fact that you are working with workers.

> At a more abstract level it is an RPC implementation for postMessage and ES6 Proxies.

[comlink](https://github.com/GoogleChromeLabs/comlink) 的核心实现基于 `postMessage` 和 [ES6 Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)，理论上在支持 `Proxy` 与类 `postMessage` 双向通信机制的 JavaScript 环境中都可以实现一套 comlink 适配器，使之可以在 WebWorkers 之外的环境使用，适配器的实现可以参考 [node-adapter](https://github.com/GoogleChromeLabs/comlink/blob/main/src/node-adapter.ts)。


部分 comlink 的高级功能需要用到 [MessageChannel](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel) 与 [MessagePort](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort) 传递，有些平台的适配器可能无法支持，涉及的高级功能有：

- 使用 `new ProxyTarget()` 构造远程代理对象
- [Comlink.proxy](https://github.com/GoogleChromeLabs/comlink#comlinktransfervalue-transferables-and-comlinkproxyvalue)
- [Comlink.createEndpoint](https://github.com/GoogleChromeLabs/comlink#comlinkcreateendpoint)


目前实现的适配器如下：

- [x] [Electron](https://www.electronjs.org/)
- [x] [Figma](https://www.figma.com/plugin-docs/)
- [x] [Chrome Extensions](https://developer.chrome.com/docs/extensions/)
- [x] [Socket.IO](https://socket.io/)

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
- `electronMainEndpoint` 用于主进程创建 `Endpoint` 对象。
- `electronRendererEndpoint` 用于渲染进程创建 `Endpoint` 对象。

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

(async function() {
    const useRemoteAdd = () => {
    return new Promise<Remote<Add>>((resolve) => {
        ipcRenderer.on('init-comlink-endponit:ack', () => {
            resolve(wrap<Add>(electronRendererEndpoint({ ipcRenderer })));
        });

        ipcRenderer.postMessage('init-comlink-endponit:syn', null);
    });
};
    const remoteAdd = await useRemoteAdd();
    const sum = await remoteAdd(1, 2);
    // output: 3
})();

```

---
### Figma Adapters

Adapters：
- `figmaCoreEndpoint` 用于 Figma 沙箱中主线程创建 `Endpoint` 对象。
- `figmaUIEndpoint` 用于 Figma UI 进程创建 `Endpoint` 对象。

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


**figmaCoreEndpoint:**

```typescript
interface FigmaCoreEndpointOptions {
    origin?: string;
    checkProps?: (props: OnMessageProperties) => boolean | Promise<boolean>;
}

interface figmaCoreEndpoint {
    (options: FigmaCoreEndpointOptions): Endpoint
}
```
- **origin:** [figma.ui.postMessage](https://www.figma.com/plugin-docs/api/properties/figma-ui-postmessage) 的 `origin` 配置，默认为 `*`。
- **checkProps:** 用于检查 [ figma.ui.on('message', (msg, props) => {})](https://www.figma.com/plugin-docs/api/properties/figma-ui-on) 返回 `props` 中的 `origin` 来源。

```typescript
// core.ts
import { expose } from 'comlink';
import { figmaCoreEndpoint } from 'comlink-adapters';

expose((a: number, b: number) => a + b, figmaCoreEndpoint());
```


**figmaUIEndpoint:**

```typescript
interface FigmaUIEndpointOptions {
    origin?: string;
}

interface figmaUIEndpoint {
    (options: FigmaUIEndpointOptions): Endpoint
}
```
- **origin:** UI iframe 中 [window:postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) 的 `targetOrigin` 配置，默认为 `*`

```typescript
// ui.ts
import { wrap } from 'comlink';
import { figmaUIEndpoint } from 'comlink-adapters';

(async function() {
    const add = wrap<(a: number, b: number) => number>(figmaUIEndpoint());
    const sum = await add(1, 2);
    // output: 3
})();
```
---

### Chrome Extensions Adapters

Adapters：
- `chromeRuntimePortEndpoint` 用于扩展基于长会话创建 `Endpoint` 对象。
- `chromeRuntimeMessageEndpoint` 用于扩展基于简单一次性请求创建 `Endpoint` 对象。

Features:
| Feature | Support | Example | Description |
| :-----| :----- | :----- | :----- |
| set | ✅ | `await proxyObj.someValue;` | |
| get | ✅ | `await (proxyObj.someValue = xxx);` | |
| apply | ✅ | `await proxyObj.applySomeMethod();` | |
| construct | ❌ | `await new ProxyObj();` | API 接口不支持传递 MessagePort |
| proxy function | ❌ | `await proxyObj.applySomeMethod(comlink.proxy(() => {}));` | 同上 |
| createEndpoint | ❌ | `proxyObj[comlink.createEndpoint]();`| 同上 |
| release | ✅ | `proxyObj[comlink.releaseProxy]();`| |


Chrome Extensions 中的通信形式主要为两种，[长会话](https://developer.chrome.com/docs/extensions/mv3/messaging/#connect)与[简单一次性请求](https://developer.chrome.com/docs/extensions/mv3/messaging/#simple)，就 comlink 使用来说更推荐长会话，其更简单也更便于理解。注意在使用扩展之间通信时需要先在  `manifest.json` 配置 [externally_connectable](https://developer.chrome.com/docs/apps/manifest/externally_connectable/)。


**chromeRuntimePortEndpoint:**

```typescript
interface chromeRuntimePortEndpoint {
    (port: chrome.runtime.Port): Endpoint
}
```

**port** [runtime.connect](https://developer.chrome.com/docs/extensions/reference/runtime/#method-connect) 或 [tabs.connect](https://developer.chrome.com/docs/extensions/reference/tabs/#method-connect) 创建的 `Port` 对象。

扩展内部消息调用，前台页面调用背景页面：

```typescript
// front.ts (content scripts/popup page/options page)
import { wrap } from 'comlink';
import { chromeRuntimePortEndpoint } from 'comlink-adapters';

(async function () {
    const port = chrome.runtime.connect({
        name: 'comlink-message-channel',
    });
    const remoteAdd = wrap<(a: number, b: number) => number>(
        chromeRuntimePortEndpoint(port)
    );
    const sum = await remoteAdd(1, 2);
    // output: 3
})();
```

```typescript
// background.ts
import { expose } from 'comlink';
import { chromeRuntimePortEndpoint } from 'comlink-adapters';

chrome.runtime.onConnect.addListener(function (port) {
    if (port.name === 'comlink-message-channel') {
        expose(
            (a: number, b: number) => a + b,
            chromeRuntimePortEndpoint(port)
        );
    }
});
```

扩展之间相互通信：

```typescript
// extension A background
import { wrap } from 'comlink';
import { chromeRuntimePortEndpoint } from 'comlink-adapters';

(async function () {
    const targetExtensionId = 'B Extension ID';
    const port = chrome.runtime.connect(targetExtensionId, {
        name: 'comlink-message-channel',
    });
    const remoteAdd = wrap<(a: number, b: number) => number>(
        chromeRuntimePortEndpoint(port)
    );
    const sum = await remoteAdd(1, 2);
    // output: 3
})();
```

```typescript
// extension B background
import { expose } from 'comlink';
import { chromeRuntimePortEndpoint } from 'comlink-adapters';

chrome.runtime.onConnectExternal.addListener((port) => {
    if (port.name === 'comlink-message-channel') {
        expose(
            (a: number, b: number) => a + b,
            chromeRuntimePortEndpoint(port)
        );
    }
});
```


**chromeRuntimeMessageEndpoint:**

```typescript
interface chromeRuntimeMessageEndpoint {
    (options?: { tabId?: number; extensionId?: string }): Endpoint;
}
```

- **tabId** 与之通信的页面 tab id
- **extensionId** 与之通信扩展 id

如果不提供 `tabId` 和 `extensionId` 则表明时插件的内部页面间通信。

插件内部页面与背景页通信：

```typescript
// popup page/options page
import { wrap } from 'comlink';
import { chromeRuntimeMessageEndpoint } from 'comlink-adapters';

(async function () {
    const remoteAdd = wrap<(a: number, b: number) => number>(
        chromeRuntimeMessageEndpoint()
    );
    const sum = await remoteAdd(1, 2);
    // output: 3
})();
```

```typescript
// background
import { expose } from 'comlink';
import { chromeRuntimeMessageEndpoint } from 'comlink-adapters';

expose((a: number, b: number) => a + b, chromeRuntimeMessageEndpoint());
```

Content Scripts 与背景页通信：

```typescript
// content scripts
import { wrap } from 'comlink';
import { chromeRuntimeMessageEndpoint } from 'comlink-adapters';

(async function () {
    await chrome.runtime.sendMessage('create-expose-endpoint');
    const remoteAdd = wrap<(a: number, b: number) => number>(
        chromeRuntimeMessageEndpoint()
    );
    const sum = await remoteAdd(1, 2);
    // output: 3
})();
```

```typescript
// background
import { expose } from 'comlink';
import { chromeRuntimeMessageEndpoint } from 'comlink-adapters';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message === 'create-expose-endpoint') {
        expose(
            (a: number, b: number) => a + b,
            chromeRuntimeMessageEndpoint({ tabId: sender.tab?.id })
        );
        sendResponse();
        return true;
    }

    sendResponse();
    return true;
});
```

扩展之间相互通信：

```typescript
// extension A background
import { wrap } from 'comlink';
import { chromeRuntimeMessageEndpoint } from 'comlink-adapters';

(async function () {
    const targetExtensionID = 'B Extension ID';
    chrome.runtime.sendMessage(targetExtensionID, 'create-expose-endpoint');
    const remoteAdd = wrap<(a: number, b: number) => number>(
        chromeRuntimeMessageEndpoint()
    );
    const sum = await remoteAdd(1, 2);
    // output: 3
})();
```

```typescript
// extension B background
import { expose } from 'comlink';
import { chromeRuntimeMessageEndpoint } from 'comlink-adapters';

chrome.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse) => {
        if (message === 'create-expose-endpoint') {
            expose(
                (a: number, b: number) => a + b,
                chromeRuntimeMessageEndpoint({
                    extensionId: sender.id,
                })
            );
            sendResponse();
            return true;
        }

        sendResponse();
        return true;
    }
);
```
---

### Socket.io Adapters

Adapters：
- `socketIoEndpoint` 用于 socket.io 在客户端与服务端创建 `Endpoint` 对象。

Features:
| Feature | Support | Example | Description |
| :-----| :----- | :----- | :----- |
| set | ✅ | `await proxyObj.someValue;` | |
| get | ✅ | `await (proxyObj.someValue = xxx);` | |
| apply | ✅ | `await proxyObj.applySomeMethod();` | |
| construct | ❌ | `await new ProxyObj();` | 不支持 MessagePort 传递 |
| proxy function | ❌ | `await proxyObj.applySomeMethod(comlink.proxy(() => {}));` | 同上 |
| createEndpoint | ❌ | `proxyObj[comlink.createEndpoint]();`| 同上 |
| release | ✅ | `proxyObj[comlink.releaseProxy]();`| |


**socketIoEndpoint:**

```typescript
interface SocketIoEndpointOptions {
    socket: ServerSocket | ClientSocket;
    messageChannel?: string;
}

interface socketIoEndpoint {
    (options: SocketIoEndpointOptions): Endpoint
}
```
- **socket:** `socket.io` 或 `socket.io-client` 创建的 socket 实例。
- **messageChannel:** 用于 socket 实例发送/监听 comlink 消息所用事件名称，可以通过不同 `messageChannel` 创建不同的 endpoint，默认为 `__COMLINK_MESSAGE_CHANNEL__`。

```typescript
// server.ts
import Koa from 'koa';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { expose } from 'comlink';
import { socketIoEndpoint } from '@socket/adapters';

const app = new Koa();
const httpServer = createServer(app.callback());
const io = new Server(httpServer, {});

io.on('connection', (socket) => {
    expose((a: number, b: number) => a + b, socketIoEndpoint({ socket }));
});

httpServer.listen(3000);
```

```typescript
// client.ts
import { io } from 'socket.io-client';
import { wrap } from 'comlink';
import { socketIoEndpoint } from 'comlink-adapters';

export async function useSocketIo() {
    const socket = io('ws://localhost:3000');
    const add = wrap<(a: number, b: number) => number>(socketIoEndpoint({ socket }));
    const sum = await add(1, 2);
    // output: 3
}
```
---

## 开发

install

```bash
pnpm i
```

dev
```bash
cd core
pnpm run dev
```

```bash
cd examples/xxx-demo
pnpm run dev
# or
pnpm -r run dev
```

build

```bash
cd core
pnpm run build
```
