# DeckDIFF Web

[English](README.md) | 简体中文

独立运行的炉石传说卡组比较网页。输入两个卡组代码，查看主卡组、数量与备牌差异，支持官方卡图和整站中英文切换。

本项目参考 **[mrzealot/deckdiff](https://github.com/mrzealot/deckdiff)** 的卡组比较思路与使用方式，将浏览器扩展的核心用途重新实现为独立网页。本项目为独立实现，非参考项目原作者发布的官方网页版本。参考来源与数据版权说明见 [NOTICE.md](NOTICE.md)。

正式名称统一为 **DeckDIFF Web**，中英文界面均使用该名称；仓库、项目目录与包名使用 `deckdiff-web`。

## 依赖项与运行条件

本仓库不附带 Node.js 或浏览器，也不会自动安装软件。首次使用时请先安装并检查以下依赖。

| 项目 | 要求 / 用途 |
| --- | --- |
| Node.js | **22.9.0 或更新版本**，用于运行服务端。从 [Node.js 官方网站](https://nodejs.org/en/download)安装受支持的 LTS 版本，并确保终端能找到 `node`。 |
| 浏览器 | 需要支持 JavaScript ES modules、Fetch、`<dialog>` 和 CSS Grid，并启用 JavaScript。 |
| 网络连接 | 卡牌资料或卡图未命中本地缓存时，需要访问暴雪官方接口或图像 CDN。卡组差异计算在浏览器本地进行。 |

**第三方软件包依赖：无。** 服务端使用 Node.js 内置模块及内置 Fetch，前端使用原生 HTML、CSS、JavaScript，无需安装依赖包或执行构建命令。

最低版本依据：启动命令使用的 [`--env-file-if-exists`](https://nodejs.org/api/cli.html#--env-file-if-existsfile) 自 Node.js 22.9.0 提供。`package.json` 的 `engines.node` 与启动脚本使用相同要求。

浏览器的剪贴板按钮使用 Clipboard API，受浏览器权限和安全上下文限制；无法读取时可手动粘贴。首次打开默认显示英文，切换语言后会通过浏览器 Local Storage 记住选择。输入内容也保存在本地；存储不可用时仍可比较。

## 从零开始运行

### 1. 安装并验证 Node.js

打开 [Node.js 官方下载页](https://nodejs.org/en/download)，选择与你的操作系统和架构匹配的 LTS 安装包，按其说明完成安装。Windows 用户可使用官方 `.msi` 安装程序，保留添加到 PATH 的选项。

安装后关闭并重新打开终端，运行：

```text
node --version
```

输出应为 `v22.9.0` 或更新版本。如果提示找不到 `node`，请先完成 Node.js 安装和 PATH 配置，再启动项目。

### 2. 下载项目

在 GitHub 仓库页面选择 **Code → Download ZIP**，将 ZIP 解压到本地目录，然后在该目录打开终端。应能看到 `package.json`、`server.mjs` 和 `public/`。

### 3. 启动服务

| 系统 | 启动方式 |
| --- | --- |
| Windows | 双击 `start.cmd`。 |
| macOS / Linux | 在项目目录运行 `sh ./start.sh`。 |

启动脚本会检查 Node.js 是否已安装且版本达到 22.9.0。

三个系统也都可以在项目根目录直接运行以下命令。

```text
node --env-file-if-exists=.env server.mjs
```

打开 <http://127.0.0.1:3210>。命令窗口需要保持运行；按 **Ctrl + C** 停止服务。

默认模式无需创建 `.env` 或申请 API 密钥。首次启动可能显示 `.env not found. Continuing without it.`，表示使用默认配置，可以正常运行。

本项目需要 Node HTTP 服务代理官方卡牌请求，不能通过双击 `public/index.html` 运行，也不能只将 `public/` 上传到 GitHub Pages。

## 功能

- 粘贴两个卡组代码或游戏内导出的完整卡组文本；识别 `###` 卡组名。
- 按法力值、卡名排序，双栏对齐比较卡牌与携带数量。官方 `copyOfCardId` 关联的新旧版本按同一卡牌归并，备牌的所属卡牌也按此规则匹配。
- 查看差异、全部卡牌或共同卡牌；统计移出、加入、共同张数与相似度。
- 展示官方插画，点击查看完整卡图和卡牌文本。
- 官方横图缺失时，尝试使用官方关联的同卡版本横图。奇利亚斯模块和外观可从各自的官方完整卡图取插画，其他卡牌在无横图时显示纯色背景。详情使用当前版本的完整卡图。
- 整站英文 / 简体中文切换，包括按钮、提示、统计、模式、错误、卡牌详情与复制结果；用户自定义卡组名保留原文。
- 比较备牌和模块，按所属主卡牌区分，不计入主卡组张数。奇利亚斯的外观选择单独标注。
- 支持标准、狂野、经典、幻变的 v1 deckstring，兼容不含备牌标志的早期代码。
- 交换、载入示例、粘贴、清空、复制差异、Ctrl / Cmd + Enter。
- 复制结果仅列出实际增减，例如 `-1 禁忌之果`、`+1 分岔路口`；先列移出，再列加入。两边数量相同的同卡版本替换会省略。
- 官方数据不可用时仍可按原始卡牌 ID 和数量显示差异，并提示加载状态。

本工具比较组成差异，不验证当前赛季卡组是否合法。同卡归并依赖已加载的官方关联数据；没有关联或元数据不可用时按原始 ID 比较。卡牌名称相同本身不会触发归并。原始卡组代码保留，查看详情时仍使用对应版本的卡图。相似度为「共同张数 / 较大卡组张数」。

## 配置

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

## 本地缓存

- `cache/cards/` 保存卡牌资料和卡图网址，按数据来源、语言和卡牌 ID 分开存储。
- `cache/images/` 保存浏览器实际请求的完整卡图和横图。同一个官方图像网址只保存一份。服务端仍可让浏览器直接从官方地址加载无法缓存的卡图。

两种缓存都没有过期时间。每次加载和重试时，服务优先复用缓存，只向官方请求本地缺失的内容。缓存目录会自动创建，服务重启后可以继续使用，Git 会忽略该目录。需要获取官方更新或释放磁盘空间时，可以停止服务并删除项目根目录中的 `cache/`，再重新启动。

## 官方数据来源

默认通过服务端访问炉石传说官方网站卡牌库的公开网页接口。简中界面中的卡牌库和卡牌详情链接指向繁中官网。[暴雪官方卡牌库](https://hearthstone.blizzard.com/zh-tw/cards)

```text
https://hearthstone.blizzard.com/zh-cn/api/cards?ids=315,531&locale=zh_CN&pageSize=200&collectible=0,1
https://hearthstone.blizzard.com/en-us/api/cards?ids=315,531&locale=en_US&pageSize=200&collectible=0,1
```

该网页接口无需密钥，但不是承诺稳定的开发者 API；网站接口调整可能影响数据加载。服务端只查询需要的 ID，并使用官方响应提供的卡图地址。浏览器向本项目服务端发送卡牌 ID 与语言，不发送完整卡组代码。

可选的正式接口为 [Battle.net Hearthstone Game Data API](https://community.developer.battle.net/documentation/hearthstone/game-data-apis)。使用它需要：

1. 在 [Battle.net 开发者门户](https://community.developer.battle.net/)自行创建 API Client。
2. 复制 `.env.example` 为 `.env`，填写：

```dotenv
CARD_PROVIDER=battlenet
BLIZZARD_CLIENT_ID=your-client-id
BLIZZARD_CLIENT_SECRET=your-client-secret
BLIZZARD_REGION=us
```

3. 重启服务。

服务端通过 `https://oauth.battle.net/token` 获取 client credentials token，并在 `Authorization: Bearer` 请求头传递；凭据不会传给浏览器。两个数据模式均使用暴雪官方来源，不自动切换到第三方卡库。

## 测试与部署

安装上述 Node.js 后，在项目根目录运行：

```text
node --test
```

无需安装测试框架或第三方包。测试覆盖卡组解析、数量差异、备牌归属、非法输入、数据缓存、OAuth、HTTP 路由及翻译完整性。接口测试使用模拟响应，不要求 API 凭据或外网连接；浏览器及真实官网接口需要另行验证。

当前源码的验证结果和初版检查摘要见 [发布检查记录](RELEASE_CHECK.md)。

部署目标必须支持上述 Node.js 版本和长时间运行的 HTTP 进程。配置 HTTPS、服务端进程管理和请求限流需要部署平台提供相应能力，这些组件不包含在本仓库中。本项目不是纯静态站点；GitHub 用于托管源码，GitHub Pages 无法直接运行本项目服务端。

## 常见问题

- **提示缺少 Node**：先安装 Node.js，重新打开终端，确认 `node --version` 可用。
- **提示不支持 `--env-file-if-exists`**：Node.js 版本过低，升级至 22.9.0 或更新版本。
- **端口已被占用**：停止旧的服务窗口，或在 `.env` 中修改 `PORT`，再使用新端口访问。
- **只有卡牌 ID，没有卡名或图片**：点击重试加载。手动重试会继续尝试获取缺失的卡牌资料，最多尝试 3 次，并显示进度和成功或失败状态。若提示本地服务无法连接，请检查启动窗口。若提示官方接口超时或不可用，请检查服务端到官网的连接。图片仍缺失时，请检查到官方图像 CDN 的连接。
- **粘贴按钮不可用**：使用 Ctrl / Cmd + V 手动粘贴。远程部署时使用 HTTPS。

## 目录与署名

```text
public/          原生网页、卡组解析、比较与中英文文案
lib/cards.mjs    官方数据适配器、鉴权与卡牌资料缓存
cache/           自动创建的本地卡牌资料和图片缓存
server.mjs       HTTP 服务与同源卡牌代理
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
