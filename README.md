# DeckDIFF Web

English | [简体中文](README.zh-cn.md)

DeckDIFF Web is a standalone **Hearthstone deck comparison tool**. Paste two Hearthstone deck codes (deckstrings) or in-game deck exports to see which cards were added, removed, or kept. The comparison includes card quantities, sideboards, and Zilliax modules, with official Hearthstone card art.

The app is an independent web reimplementation inspired by the DeckDIFF browser extension. [Original DeckDIFF project](https://github.com/mrzealot/deckdiff) · [Attribution and notices](NOTICE.md)

## Requirements

| Requirement | Details |
| --- | --- |
| Node.js | **22.9.0 or later**. Install a supported LTS release for your platform and make sure `node` is on your PATH. [Node.js downloads](https://nodejs.org/en/download) |
| Browser | JavaScript enabled, with support for ES modules, Fetch, `<dialog>`, and CSS Grid. |
| Internet access | Required when card data or images are missing from the local cache. Deck comparison runs in your browser. |

The server uses built-in Node.js modules and Fetch. The frontend uses plain HTML, CSS, and JavaScript. The launchers run the source directly with `--env-file-if-exists`, introduced in Node.js 22.9.0. [Node.js CLI documentation](https://nodejs.org/api/cli.html#--env-file-if-existsfile)

English is selected on the first visit. The app remembers your language choice and deck inputs in your browser's local storage. Clipboard buttons use the Clipboard API, so you can paste manually if browser permissions or the page's security context prevent clipboard access.

## Run locally

### 1. Install and verify Node.js

Install the LTS release for your operating system and architecture. On Windows, the official `.msi` installer can add Node.js to your PATH. Open a new terminal and run the command below. [Official Node.js downloads](https://nodejs.org/en/download)

```text
node --version
```

The version should be `v22.9.0` or later.

### 2. Download the project

On the GitHub repository page, choose **Code → Download ZIP**. Extract the ZIP and open a terminal in the folder that contains `package.json`, `server.mjs`, and `public/`.

### 3. Start the server

| Platform | Launcher |
| --- | --- |
| Windows | Double-click `start.cmd`. |
| macOS or Linux | Run `sh ./start.sh` in the project folder. |

The launchers check the Node.js version. On any platform, you can also start the server from the project folder using the command below.

```text
node --env-file-if-exists=.env server.mjs
```

Open <http://127.0.0.1:3210>, paste or load two deck lists, and select **Compare decks**. Keep the terminal open while using the app. Press **Ctrl+C** to stop the server.

The default mode works without an API key or a `.env` file. If Node.js reports `.env not found. Continuing without it.`, the app is using the default configuration. The app requires its Node.js HTTP server to retrieve card data.

## Features

- Paste raw deck codes or full in-game exports. Custom deck names from `###` headings are preserved.
- Compare decks side by side, sorted by mana cost and card name. Filter to changes, all cards, or shared cards, and see added, removed, and shared counts.
- Match editions linked by Blizzard's `copyOfCardId` metadata, including different editions of a sideboard's owner card. Card details show the original edition from each deck.
- View official illustrations, full card images, and card text. For a missing banner, the app tries other official editions of the card. Zilliax modules and cosmetic choices can use a crop of their full card renders. Cards with no available banner have a plain background.
- Compare sideboards and modules by their owner card. They are excluded from main-deck totals, and Zilliax cosmetic choices have their own label.
- Load v1 deckstrings for Standard, Wild, Classic, and Twist, including older codes that omit the sideboard flag.
- Switch between English and Simplified Chinese. The interface, card details, and copied results follow your selection.
- Swap decks, load an example, paste or clear each input, and compare with **Ctrl / Cmd + Enter**.
- Copy quantity changes such as `-1 Fireball` and `+1 Pyroblast`. Removals come first, and swapping linked editions at the same quantity is omitted.
- Compare raw card IDs and quantities when official card data is unavailable.

Similarity is the number of shared cards divided by the size of the larger main deck. Edition matching uses Blizzard's card links and falls back to raw IDs when those links are unavailable. The tool compares deck composition. Legality depends on the current game rules.

## Configuration

To change the port or data provider, copy `.env.example` to `.env` in the project folder, edit it, and restart the server.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3210` | Local HTTP port. Choose another available port if it is already in use. |
| `HOST` | `127.0.0.1` | Listens on this machine by default. Use `0.0.0.0` for deployment or LAN access. |
| `CARD_PROVIDER` | `website` | Use `website` for the official Hearthstone card library or `battlenet` for the Battle.net API. |
| `BLIZZARD_REGION` | `us` | Battle.net API region. Supported values are `us`, `eu`, `kr`, and `tw`. |
| `BLIZZARD_CLIENT_ID` | Empty | Required in `battlenet` mode. |
| `BLIZZARD_CLIENT_SECRET` | Empty | Required in `battlenet` mode and kept on the server. |

Git ignores `.env` and local variants. The repository includes `.env.example` with placeholders.

## Local cache

- `cache/cards/` stores card data and image URLs by source, language, and card ID.
- `cache/images/` stores full card images and banners as they are requested. Images with the same source URL share one cache file. If an image cannot be cached, your browser can load it from the official source.

Both caches persist across server restarts and have no expiration. The server requests missing entries on demand, including when you retry. The cache directory is created automatically and ignored by Git. To pick up official changes or reclaim disk space, stop the server, delete `cache/`, and restart.

## Official card data

By default, the server uses the public web endpoint behind Blizzard's official card library. This endpoint works without an API key and can change as the website evolves. The browser sends card IDs and the selected language to the local server, and deckstrings are parsed in the browser. [Official Hearthstone Card Library](https://hearthstone.blizzard.com/en-us/cards)

```text
https://hearthstone.blizzard.com/en-us/api/cards?ids=315,531&locale=en_US&pageSize=200&collectible=0,1
https://hearthstone.blizzard.com/zh-cn/api/cards?ids=315,531&locale=zh_CN&pageSize=200&collectible=0,1
```

To use the Battle.net API, create an API client in the developer portal, copy `.env.example` to `.env`, set the values below, and restart the server. [Battle.net developer portal](https://community.developer.battle.net/) · [Hearthstone Game Data API](https://community.developer.battle.net/documentation/hearthstone/game-data-apis)

```dotenv
CARD_PROVIDER=battlenet
BLIZZARD_CLIENT_ID=your-client-id
BLIZZARD_CLIENT_SECRET=your-client-secret
BLIZZARD_REGION=us
```

The server obtains an OAuth client-credentials token from `https://oauth.battle.net/token` and sends it in the `Authorization: Bearer` header. Your browser receives card data, while API credentials stay on the server. Both providers use Blizzard's official data.

## Tests and deployment

Run the test suite from the project folder.

```text
node --test
```

The built-in tests cover deckstring parsing, quantities, sideboard ownership, invalid inputs, disk caching, OAuth, HTTP routes, and translation coverage. API tests use mock responses and run without credentials or internet access. [Release verification in Simplified Chinese](RELEASE_CHECK.md)

Deploy to a host that supports Node.js 22.9.0 or later and a long-running HTTP process. HTTPS, process management, and rate limiting are handled by the hosting platform. The server requires a Node.js host, so static hosts such as GitHub Pages cannot run it.

## Troubleshooting

- **Node.js is missing.** Install it, reopen the terminal, and verify that `node --version` works.
- **Node.js rejects `--env-file-if-exists`.** Upgrade to Node.js 22.9.0 or later.
- **The port is already in use.** Stop the old instance or set another `PORT` in `.env`, then open the corresponding local URL.
- **Card names or images are missing.** Select **Retry loading** when the option appears. It makes up to three attempts to fetch missing card data. If the local server is unreachable, check its terminal. If the official API times out, check whether the server can reach Blizzard. If images are missing, check access to Blizzard's image CDN.
- **The Paste button is unavailable.** Paste with **Ctrl / Cmd + V**. Use HTTPS for remote deployments.

## Project layout

```text
public/          Web UI, deckstring parsing, comparison, and translations
lib/cards.mjs    Official data providers, authentication, and card metadata cache
cache/           Runtime cache for card data and images
server.mjs       HTTP server and same-origin card proxy
test/            Node.js tests
start.cmd        Windows launcher
start.sh         macOS and Linux launcher
.env.example     Configuration template
NOTICE.md        Attribution and third-party content notices
LICENSE          Full GNU GPLv2 license
```

The deckstring parser is implemented in this repository. HearthSim's format and reference implementation were used as references. [HearthSim deckstrings](https://github.com/HearthSim/npm-deckstrings)

## License

The software is licensed under the **GNU General Public License, version 2 only** (`GPL-2.0-only`). [Full license](LICENSE)

Hearthstone card names, text, artwork, and related trademarks belong to Blizzard Entertainment. DeckDIFF Web is an independent project. [Third-party content notices](NOTICE.md)
