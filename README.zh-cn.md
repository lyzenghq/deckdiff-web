# DeckDIFF Web

**[静态版在线体验入口](https://lyzenghq.github.io/deckdiff-web/)**

[English](README.md) | 简体中文

独立运行的炉石传说卡组比较网页。输入两个卡组代码，查看主卡组、数量与备牌差异，支持卡图和整站中英文切换。

本项目参考 **[mrzealot/deckdiff](https://github.com/mrzealot/deckdiff)** 的卡组比较思路与使用方式，将浏览器扩展的核心用途重新实现为独立网页。本项目为独立实现，非参考项目原作者发布的官方网页版本。参考来源与数据版权说明见 [NOTICE.md](NOTICE.md)。

正式名称统一为 **DeckDIFF Web**，中英文界面均使用该名称；仓库、项目目录与包名使用 `deckdiff-web`。

## 怎么选版本

**日常比较直接用在线版。** 打开网页，粘贴两套卡组代码即可。两个版本的比较功能相同，都在浏览器里计算差异。

### Node.js 版的优势

- **断网时也想查看常用卡牌的资料和卡图。** 本地服务会把成功加载的卡牌资料和图片保存到磁盘，重启后仍可复用。所需资料和图片都已缓存时，断网也能比较这些卡组。资料按语言缓存，完整卡图在打开卡牌详情时加载。
- **想直接从暴雪查询本地尚未缓存的卡。** 新卡只要已收录在所选的官方接口中，本地服务就能按需查询。在线版使用最近一次部署时生成的卡库。已缓存的记录可以按需清理，再获取官方更新。

### 运行和数据差异

| 项目 | Node.js 版 | 静态版 |
| --- | --- | --- |
| 运行与部署 | [本地运行](#本地运行-nodejs-版)或[部署到 Node.js 主机](#部署-nodejs-版) | [本地运行](#本地运行静态版)或[发布到 GitHub Pages](#发布静态版到-github-pages) |
| 运行环境 | 持续运行 Node.js HTTP 服务 | 由静态 HTTP 服务提供 `dist/`，构建时使用 Node.js |
| 卡牌资料 | 默认使用暴雪官网卡牌库接口，由服务端按需查询缺失记录 | 默认在构建时从 HearthstoneJSON 下载中英文卡库，随网站发布 JSON 分片 |
| 卡图 | 服务端按需获取并缓存暴雪卡图 | 浏览器按需从所选数据源的图片 CDN 加载 |
| 数据更新 | 本地缓存一直保留，直到主动清理 | 每次构建生成一版卡库。GitHub Pages 部署成功后使用新版 |

首次打开默认显示英文，浏览器会记住语言选择和输入的卡组代码。卡名、卡图和同卡归并结果取决于所选数据源提供的资料。

## 依赖项与运行条件

本仓库不附带 Node.js 或浏览器，也不会自动安装软件。首次使用时请先安装并检查以下依赖。

| 项目 | 要求 / 用途 |
| --- | --- |
| Node.js | **22.9.0 或更新版本**，用于运行 Node.js 版或在本地构建静态版。安装受支持的 LTS 版本后，用 `node --version` 确认终端能找到 `node`。[Node.js 官方下载](https://nodejs.org/en/download) |
| 浏览器 | 需要支持 JavaScript ES modules、Fetch、`<dialog>` 和 CSS Grid，并启用 JavaScript。 |

服务端使用 Node.js 内置模块和 Fetch，前端使用原生 HTML、CSS、JavaScript。两个版本都无需安装第三方 npm 包。

启动和构建命令使用 Node.js 22.9.0 引入的 `--env-file-if-exists`。`package.json` 与启动脚本使用相同的最低版本要求。[Node.js 命令行文档](https://nodejs.org/api/cli.html#--env-file-if-existsfile)

剪贴板按钮使用 Clipboard API。浏览器限制剪贴板访问时，可以手动粘贴。

## Node.js 版

### 本地运行 Node.js 版

1. 安装 Node.js 后，重新打开终端并运行 `node --version`。Windows 可使用官方 `.msi` 安装程序，保留添加到 PATH 的选项。
2. 在 GitHub 仓库页面选择 **Code → Download ZIP** 并解压，进入包含 `package.json`、`server.mjs` 和 `public/` 的目录。
3. 使用对应系统的启动脚本，或在项目根目录运行 `npm start`。

| 系统 | 启动方式 |
| --- | --- |
| Windows | 双击 `start.cmd`。 |
| macOS / Linux | 在项目目录运行 `sh ./start.sh`。 |

启动脚本会检查 Node.js 是否已安装且版本达到 22.9.0。

也可以直接用 Node.js 启动。

```text
node --env-file-if-exists=.env server.mjs
```

打开 <http://127.0.0.1:3210>。使用时保持终端窗口运行，按 **Ctrl + C** 停止服务。

默认模式无需创建 `.env` 或申请 API 密钥。首次启动可能显示 `.env not found. Continuing without it.`，表示使用默认配置，可以正常运行。

### 配置

如需更改端口或数据来源，先将根目录的 `.env.example` 复制为 `.env`，使用文本编辑器修改并保存，然后重启服务。这一步可以通过文件管理器完成，无需额外命令行工具。

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3210` | 本地 HTTP 端口；端口冲突时改为其他可用端口。 |
| `HOST` | `127.0.0.1` | 默认只监听本机；部署或局域网访问时可设置为 `0.0.0.0`。 |
| `CARD_PROVIDER` | `website` | `website` 为炉石官网，`battlenet` 为正式 Battle.net API。 |
| `BLIZZARD_REGION` | `us` | Battle.net API 区域，支持 `us`、`eu`、`kr`、`tw`。 |
| `BLIZZARD_CLIENT_ID` | 空 | 仅 `battlenet` 模式必填。 |
| `BLIZZARD_CLIENT_SECRET` | 空 | 仅 `battlenet` 模式必填，保留在服务端。 |

`.env` 及其本地变体已被 `.gitignore` 忽略；只将不含真实凭据的 `.env.example` 提交到仓库。

### 本地缓存

- `cache/cards/` 保存卡牌资料和卡图网址，按数据来源、语言和卡牌 ID 分开存储。
- `cache/images/` 保存浏览器实际请求的完整卡图和横图。同一个官方图像网址只保存一份。服务端仍可让浏览器直接从官方地址加载无法缓存的卡图。

两种缓存都没有过期时间。每次加载和重试时，服务优先复用缓存，只向官方请求本地缺失的内容。缓存目录会自动创建，服务重启后可以继续使用，Git 会忽略该目录。需要获取官方更新或释放磁盘空间时，可以停止服务并删除项目根目录中的 `cache/`，再重新启动。

### 官方数据来源

默认通过服务端访问炉石传说官方网站卡牌库的公开网页接口。简中界面中的卡牌库和卡牌详情链接指向繁中官网。[暴雪官方卡牌库](https://hearthstone.blizzard.com/zh-tw/cards)

```text
https://hearthstone.blizzard.com/zh-cn/api/cards?ids=315,531&locale=zh_CN&pageSize=200&collectible=0,1
https://hearthstone.blizzard.com/en-us/api/cards?ids=315,531&locale=en_US&pageSize=200&collectible=0,1
```

该网页接口无需密钥，但不是承诺稳定的开发者 API；网站接口调整可能影响数据加载。服务端只查询需要的 ID，并使用官方响应提供的卡图地址。浏览器向本项目服务端发送卡牌 ID 与语言，不发送完整卡组代码。

也可以通过正式的 Battle.net API 获取卡牌资料。在开发者门户创建 API Client 后，复制 `.env.example` 为 `.env`，按下方示例填写并重启服务。[Battle.net 开发者门户](https://community.developer.battle.net/) · [Hearthstone Game Data API](https://community.developer.battle.net/documentation/hearthstone/game-data-apis)

```dotenv
CARD_PROVIDER=battlenet
BLIZZARD_CLIENT_ID=your-client-id
BLIZZARD_CLIENT_SECRET=your-client-secret
BLIZZARD_REGION=us
```

服务端通过 `https://oauth.battle.net/token` 获取 client credentials token，并在 `Authorization: Bearer` 请求头传递。凭据始终留在服务端，两个数据模式均使用暴雪官方来源。

### 部署 Node.js 版

将项目部署到支持 Node.js 22.9.0 或更新版本、可持续运行 HTTP 进程的主机，启动命令为 `npm start`。如果托管平台需要程序监听网络接口，设置 `HOST=0.0.0.0`，并使用平台分配的 `PORT`。公开部署时使用 HTTPS，以便浏览器支持剪贴板按钮。

## 静态版

### 卡牌资料和图片来源

构建时从 HearthstoneJSON 下载当时可用的最新中英文卡库。`dist/` 包含网页、数据清单和双语 JSON 分片。卡牌记录包括 ID、名称、描述、费用、职业、同卡版本关联和卡图地址，也覆盖奇利亚斯模块和外观。[HearthstoneJSON 卡牌数据文档](https://hearthstonejson.com/docs/cards.html)

比较时，浏览器从站内读取清单和当前语言所需的分片。列表横图和详情完整卡图按需从 HearthstoneJSON 的图片 CDN 加载。只要站内 JSON 能加载，即使图片 CDN 暂时不可用，卡名、描述和比较结果也能显示。[HearthstoneJSON 卡图接口](https://hearthstonejson.com/docs/images.html)

### 本地运行静态版

在项目根目录用 Node.js 22.9.0 或更新版本构建，再通过 HTTP 提供 `dist/`。下面以 Python 3 的静态文件服务为例。

```sh
npm run build:pages
python3 -m http.server --bind 127.0.0.1 --directory dist 3211
```

打开 <http://127.0.0.1:3211/>。如果本机通过 `python` 启动 Python 3，把命令中的 `python3` 换成 `python` 即可。已有构建好的 `dist/` 时，只需运行启动 HTTP 服务的命令。需要刷新本地卡库时，重新运行 `npm run build:pages`。也可以将 `dist/` 的内容上传到其他静态主机的网站目录。

### 发布静态版到 GitHub Pages

1. 确认仓库的默认分支为 `main`，并已包含[发布工作流](.github/workflows/pages.yml)。
2. 打开仓库的 **Settings → Pages**，将 **Build and deployment → Source** 设为 **GitHub Actions**。
3. 打开 **Actions → Deploy static site to GitHub Pages → Run workflow**，选择 `main`。工作流会运行测试、构建 `dist/` 并发布该目录。默认的 HearthstoneJSON 构建无需配置凭据。
4. 部署成功后，打开 **Settings → Pages** 显示的地址。本仓库的项目站点地址是 [lyzenghq.github.io/deckdiff-web](https://lyzenghq.github.io/deckdiff-web/)。

工作流计划每天北京时间 16:17（UTC 08:17）运行。手动运行，或向 `main` 推送涉及工作流所监控文件的改动，也会触发构建。工作流每次拉取上游当时可用的最新卡库，构建失败时线上继续使用上次发布成功的版本。公开发布前，请核对卡牌数据的版权声明和适用的分发条款。[GitHub Pages 配置文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow) · [来源及版权说明](NOTICE.md)

### 可选的 Battle.net 构建数据源

将静态构建的 `PAGES_CARD_SOURCE` 设为 `battlenet`。本地构建时，把该变量和 Battle.net 凭据写入 `.env`。使用 GitHub Pages 时，在 **Settings → Secrets and variables → Actions → Variables** 添加 `PAGES_CARD_SOURCE`，再将 `BLIZZARD_CLIENT_ID` 和 `BLIZZARD_CLIENT_SECRET` 添加为 Actions 密钥。可选变量 `BLIZZARD_REGION` 默认为 `us`。

此构建来源使用暴雪正式 API 返回的资料和卡图网址。30 天过期规则仅适用于 Battle.net 卡库快照。若刷新持续失败，请在期限内替换或撤下已发布的旧快照。[暴雪开发者 API 条款](https://www.blizzard.com/en-us/legal/a2989b50-5f16-43b1-abec-2ae17cc09dd6/blizzard-developer-api-terms-of-use)

## 功能

- 粘贴两个卡组代码或游戏内导出的完整卡组文本，识别 `###` 卡组名。
- 按法力值、卡名排序，双栏对齐比较卡牌与携带数量。卡库中明确关联的新旧版本按同一卡牌归并，备牌的所属卡牌也按此规则匹配。
- 查看差异、全部卡牌或共同卡牌，统计移出、加入、共同张数与相似度。
- 展示插画，点击查看完整卡图和卡牌文本。
- Node.js 版在官方横图缺失时尝试使用其他官方关联版本的横图。奇利亚斯模块和外观可从各自的完整卡图取插画。
- 整站英文 / 简体中文切换，包括按钮、提示、统计、模式、错误、卡牌详情与复制结果。用户自定义卡组名保留原文。
- 按所属主卡牌比较备牌和模块，主卡组张数单独统计。奇利亚斯的外观选择单独标注。
- 支持标准、狂野、经典、幻变的 v1 deckstring，兼容不含备牌标志的早期代码。
- 交换、载入示例、粘贴、清空、复制差异、Ctrl / Cmd + Enter。
- 复制结果仅列出实际增减，例如 `-1 禁忌之果`、`+1 分岔路口`。先列移出，再列加入。两边数量相同的同卡版本替换会省略。
- 卡牌数据不可用时仍可按原始卡牌 ID 和数量显示差异，并提示加载状态。

本工具比较组成差异，不验证当前赛季卡组是否合法。没有同卡关联数据时按原始 ID 比较。卡牌名称相同本身不会触发归并。原始卡组代码保留，查看详情时仍使用对应版本的卡图。相似度为「共同张数 / 较大卡组张数」。

## 测试

在项目根目录运行测试。

```sh
npm test
```

测试覆盖卡组解析、数量差异、备牌归属、非法输入、数据缓存、OAuth、HTTP 路由、静态构建及翻译完整性。接口测试使用模拟响应，可在无需 API 凭据或外网连接的环境运行。[发布检查记录](RELEASE_CHECK.md)

## 常见问题

- **提示缺少 Node**：先安装 Node.js，重新打开终端，确认 `node --version` 可用。
- **提示不支持 `--env-file-if-exists`**：Node.js 版本过低，升级至 22.9.0 或更新版本。
- **端口已被占用**。Node.js 版在 `.env` 中修改 `PORT`，静态预览则修改启动命令中的 `3211`。用新端口打开网页。
- **卡名或图片缺失**。可以点击重试加载。Node.js 版需确认服务已启动且能访问暴雪接口。静态版需确认服务器可以提供 `dist/` 中的 `data/manifest.json` 和对应的 JSON 分片。如果只有图片缺失，检查所选数据源的图片 CDN 能否访问。
- **粘贴按钮不可用**：使用 Ctrl / Cmd + V 手动粘贴。远程部署时使用 HTTPS。

## 目录与署名

```text
public/          原生网页、卡组解析、比较与中英文文案
lib/cards.mjs    官方数据适配器、鉴权与卡牌资料缓存
cache/           自动创建的本地卡牌资料和图片缓存
server.mjs       HTTP 服务与同源卡牌代理
scripts/         静态站点构建脚本和 HearthstoneJSON 数据适配器
dist/            生成的静态站点和待发布的卡牌数据
.github/workflows/pages.yml  GitHub Pages 构建与发布工作流
test/            Node.js 内置测试
start.cmd        Windows 启动入口
start.sh         macOS / Linux 通用启动脚本
.env.example     不含凭据的配置示例
NOTICE.md        原项目、格式参考及数据版权说明
LICENSE          GNU GPLv2 完整许可证文本
```

- 参考项目：[mrzealot/deckdiff](https://github.com/mrzealot/deckdiff)。
- Deckstring 格式参考：[HearthSim/npm-deckstrings](https://github.com/HearthSim/npm-deckstrings)。本项目使用自身解析模块，未将该 npm 包作为依赖安装或分发。
- 卡牌名称、文本、图片及相关商标归 Blizzard Entertainment 所有。本项目与暴雪无隶属关系。

## 许可证

本项目的软件代码采用 **GNU General Public License version 2 only（GPLv2，仅第 2 版）**，SPDX 标识为 `GPL-2.0-only`。完整条款见 [LICENSE](LICENSE)。

卡牌名称、文本、图片及暴雪相关商标不属于本项目 GPLv2 授权范围。参考项目及外部内容的说明见 [NOTICE.md](NOTICE.md)。
