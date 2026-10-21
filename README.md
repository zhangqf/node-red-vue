# switch-machine

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```

## 后端 Node-RED（本地开发）

```sh
cd nr
../node_modules/.bin/node-red -s settings.cjs
```

三个条件缺一不可：

| 条件 | 原因 |
| --- | --- |
| 用**项目本地**的 `node_modules/.bin/node-red` | 全局装的 node-red 扫不到项目里的 `node-red-node-sqlite`、`node-red-contrib-uuid`，flows 会卡在「Waiting for missing types to be registered」，所有接口 404 |
| 工作目录在 `nr/` | flows 里的 sqlite 节点用相对路径 `./data/device.db` |
| 带 `-s settings.cjs` | 不带就落到 `~/.node-red/settings.js`，没有 `credentialSecret`，且拿不到 `functionGlobalContext`（`rootPath`/`fs`/`path`） |

Windows 上跑开机自启服务见 `deploy/windows/README.md`。

### 改 device.db 之前

`nr/data/device.db` 是被 git 跟踪的二进制文件。**先停 Node-RED 再改**——它持有这个文件的句柄，运行中覆盖会丢数据。改完 `git pull` 部署到现场机器时如果因为这个二进制文件被拒绝覆盖，用 `deploy/windows/update.ps1`。
