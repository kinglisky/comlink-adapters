<h1 align="center">comlink-adapters</h1>

<div align="center">
Implementation of comlink adapters for different application platforms

[English](README.md) &nbsp;&nbsp;|&nbsp;&nbsp; [简体中文](README_ZH.md)
</div>

## Introduction

> Comlink makes WebWorkers enjoyable. Comlink is a tiny library (1.1kB), that removes the mental barrier of thinking about postMessage and hides the fact that you are working with workers.

> At a more abstract level it is an RPC implementation for postMessage and ES6 Proxies.

The core implementation of [comlink](https://github.com/GoogleChromeLabs/comlink) is based on `postMessage` and [ES6 Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy). In theory, a comlink adapter can be implemented in any JavaScript environment that supports `Proxy` and `postMessage` bi-directional communication mechanisms, making it possible to use it in environments other than WebWorkers. The implementation of the adapter can refer to [node-adapter](https://github.com/GoogleChromeLabs/comlink/blob/main/src/node-adapter.ts).

Some advanced features of comlink require the use of [MessageChannel](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel) and [MessagePort](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort) for transmission, and some platform adapters may not support these features. These advanced features include:

- Constructing remote proxy objects with `new ProxyTarget()`
- [Comlink.proxy](https://github.com/GoogleChromeLabs/comlink#comlinktransfervalue-transferables-and-comlinkproxyvalue)
- [Comlink.createEndpoint](https://github.com/GoogleChromeLabs/comlink#comlinkcreateendpoint)

The currently implemented adapters are as follows:

- [x] [Electron](https://www.electronjs.org/)
- [x] [Figma](https://www.figma.com/plugin-docs/)
- [x] [Chrome extensions](https://developer.chrome.com/docs/extensions/)
- [x] [Socket.IO](https://socket.io/)

We welcome you to raise [issues](https://github.com/kinglisky/comlink-adapters/issues) or to contribute to the development of adapters for other application platforms.

## Guide

### Installation

```bash
# npm
npm i comlink comlink-adapters -S
# yarn
yarn add comlink comlink-adapters
# pnpm
pnpm add comlink comlink-adapters
```

### Electron Adapters

Adapters:
- `electronMainEndpoint` is used to create `Endpoint` objects in the main process.
- `electronRendererEndpoint` is used to create `Endpoint` objects in the rendering process.

Features:
| Feature | Support | Example | Description |
| :-----| :----- | :----- | :----- |
| set | ✅ | `await proxyObj.someValue;` | |
| get | ✅ | `await (proxyObj.someValue = xxx);` | |
| apply | ✅ | `await proxyObj.applySomeMethod();` | |
| construct | ✅ | `await new ProxyObj();` | |
| proxy function | ✅ | `await proxyObj.applySomeMethod(comlink.proxy(() => {}));` | |
| createEndpoint | ✅ | `proxyObj[comlink.createEndpoint]();`| Not recommended to use |
| release | ✅ | `proxyObj[comlink.releaseProxy]();`| |

Support for `createEndpoint` is provided, but it is not recommended to use. The internal implementation bridges MessagePort and MessagePortMain, which results in poor efficiency.


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
- **sender：** The renderer WebContents object to communicate with.
- **ipcMain：** The IpcMain object in Electron.
- **messageChannelConstructor：** Constructor of MessageChannel, using MessageChannelMain in the main process.
- **channelName：** The IPC channel identifier, default is `__COMLINK_MESSAGE_CHANNEL__`. Multiple pairs of comlink endpoints can be created via channelName.

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

- **ipcRenderer：** The IpcRenderer object in Electron.
- **channelName：** IPC channel identifier.

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

Adapters:
- `figmaCoreEndpoint` is used to create `Endpoint` objects in the main thread of the Figma sandbox.
- `figmaUIEndpoint` is used to create `Endpoint` objects in the Figma UI process.

Features:
| Feature | Support | Example | Description |
| :-----| :----- | :----- | :----- |
| set | ✅ | `await proxyObj.someValue;` | |
| get | ✅ | `await (proxyObj.someValue = xxx);` | |
| apply | ✅ | `await proxyObj.applySomeMethod();` | |
| construct | ❌ | `await new ProxyObj();` | The Core thread does not support MessageChannel, and the MessagePort cannot be transferred between Core and UI threads |
| proxy function | ❌ | `await proxyObj.applySomeMethod(comlink.proxy(() => {}));` | Same as above |
| createEndpoint | ❌ | `proxyObj[comlink.createEndpoint]();`| Same as above |
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
- **origin:** Configuration of `origin` in [figma.ui.postMessage](https://www.figma.com/plugin-docs/api/properties/figma-ui-postmessage), default is `*`.
- **checkProps:** Used to check the origin in `props` returned by [figma.ui.on('message', (msg, props) => {})](https://www.figma.com/plugin-docs/api/properties/figma-ui-on).

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
- **origin:** `targetOrigin` configuration in [window:postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) of UI iframe, default is `*`

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

Adapters:
- `chromeRuntimePortEndpoint` is used to create `Endpoint` objects for extensions based on long-lived connections.
- `chromeRuntimeMessageEndpoint` is used to create `Endpoint` objects for extensions based on simple one-off requests.

Features:
| Feature | Support | Example | Description |
| :-----| :----- | :----- | :----- |
| set | ✅ | `await proxyObj.someValue;` | |
| get | ✅ | `await (proxyObj.someValue = xxx);` | |
| apply | ✅ | `await proxyObj.applySomeMethod();` | |
| construct | ❌ | `await new ProxyObj();` | API does not support passing MessagePort |
| proxy function | ❌ | `await proxyObj.applySomeMethod(comlink.proxy(() => {}));` | Same as above |
| createEndpoint | ❌ | `proxyObj[comlink.createEndpoint]();`| Same as above |
| release | ✅ | `proxyObj[comlink.releaseProxy]();`| |


The two main types of communication in Chrome Extensions are [long-lived connections](https://developer.chrome.com/docs/extensions/mv3/messaging/#connect) and [simple one-off requests](https://developer.chrome.com/docs/extensions/mv3/messaging/#simple). For the use of comlink, it is more recommended to use long-lived connections, which are simpler and easier to understand. Note that when using communication between extensions, you need to configure [externally_connectable](https://developer.chrome.com/docs/apps/manifest/externally_connectable/) in `manifest.json` first.


**chromeRuntimePortEndpoint:**

```typescript
interface chromeRuntimePortEndpoint {
    (port: chrome.runtime.Port): Endpoint
}
```

**port** A `Port` object created by [runtime.connect](https://developer.chrome.com/docs/extensions/reference/runtime/#method-connect) or [tabs.connect](https://developer.chrome.com/docs/extensions/reference/tabs/#method-connect).

Communication between the front and background pages within the extension:

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

Communication between different extensions:

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

- **tabId** The tab id of the page to communicate with
- **extensionId** The id of the extension to communicate with

If neither `tabId` nor `extensionId` is provided, it means that the communication is between internal pages of the plugin.

Communication between internal pages and background pages of the plugin:

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

Communication between content scripts and background pages:

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
import {

 expose } from 'comlink';
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

Communication between different extensions:

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

Adapters:
- `socketIoEndpoint` is used to create an `Endpoint` object on the client and server side with socket.io.

Features:
| Feature | Support | Example | Description |
| :-----| :----- | :----- | :----- |
| set | ✅ | `await proxyObj.someValue;` | |
| get | ✅ | `await (proxyObj.someValue = xxx);` | |
| apply | ✅ | `await proxyObj.applySomeMethod();` | |
| construct | ❌ | `await new ProxyObj();` | Passing of MessagePort is not supported |
| proxy function | ❌ | `await proxyObj.applySomeMethod(comlink.proxy(() => {}));` | As above |
| createEndpoint | ❌ | `proxyObj[comlink.createEndpoint]();`| As above |
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
- **socket:** The socket instance created by `socket.io` or `socket.io-client`.
- **messageChannel:** The event name used for sending/listening to comlink messages through socket instances. Different endpoints can be created by different messageChannel. The default is __COMLINK_MESSAGE_CHANNEL__.

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

(async function() {
    const socket = io('ws://localhost:3000');
    const add = wrap<(a: number, b: number) => number>(socketIoEndpoint({ socket }));
    const sum = await add(1, 2);
    // output: 3
})();
```
---

## Development

Install

```bash
pnpm i
```

Development
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

Build

```bash
cd core
pnpm run build
```
