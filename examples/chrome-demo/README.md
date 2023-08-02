# chrome extensions demo

## start

```bash
pnpm -r run dev
```

开发调试时需要修改两插件目录下的通信扩展 id：

- `manifest.json` 的 `externally_connectable.ids`
- `scripts\constant.ts` 通信扩展 id

The instructions to modify the communication extension id in the directories of two plugins during development and debugging are as follows:

- Modify the `externally_connectable.ids` in `manifest.json`.
- Modify the communication extension id in `scripts\constant.ts`.