# DeckDIFF Web

**[Try the static edition online](https://lyzenghq.github.io/deckdiff-web/)**

English | [简体中文](README.zh-cn.md)

DeckDIFF Web is a standalone **Hearthstone deck comparison tool**. Paste two Hearthstone deck codes (deckstrings) or in-game deck exports to see which cards were added, removed, or kept. The comparison includes card quantities, sideboards, and Zilliax modules, with Hearthstone card art.

The app is an independent web reimplementation inspired by the DeckDIFF browser extension. [Original DeckDIFF project](https://github.com/mrzealot/deckdiff) · [Attribution and notices](NOTICE.md)

## Choose an edition

**Use the online edition for everyday comparisons.** Open it in your browser and paste two deck codes. Both editions compare decks in the browser and offer the same comparison tools.

### Advantages of the Node.js edition

- **Keep card data and artwork for offline use.** The local server saves successfully fetched card data and images to disk and reuses them after a restart. Once all the data and images you need are cached, you can compare those decks while offline. Card data is cached by language, and full card images are fetched when you open card details.
- **Look up uncached cards directly from Blizzard.** If a new card is already in the selected Blizzard source, the local server can fetch it on demand. The online edition uses the catalog from its latest deployment. You can clear the local cache when you want to refresh records you already have.

### Edition details

| | Node.js edition | Static edition |
| --- | --- | --- |
| Run or deploy | [Run locally](#run-the-nodejs-edition-locally) or [deploy to a Node.js host](#deploy-the-nodejs-edition) | [Run locally](#run-the-static-edition-locally) or [publish to GitHub Pages](#publish-the-static-edition-to-github-pages) |
| What runs | A Node.js HTTP server | A static HTTP host serving the built `dist/` directory. Node.js runs during the build. |
| Card data | Blizzard's public card library endpoint by default. The server fetches missing records when needed. | HearthstoneJSON by default. The build downloads the bilingual catalog and publishes it as JSON files with the site. |
| Card images | The server fetches and caches Blizzard images on demand. | The browser requests images on demand from the selected source's image CDN. |
| Updates | Cached records and images persist until cleared. | A new build generates a new catalog snapshot. GitHub Pages serves it after a successful deployment. |

English is selected on the first visit. The app remembers your language choice and deck inputs in your browser's local storage. Card names, images, and edition matching depend on the selected data source.

## Requirements

| Requirement | Details |
| --- | --- |
| Node.js | **22.9.0 or later** to run the Node.js edition or build the static edition locally. Install a supported LTS release and make sure `node` is on your PATH. [Node.js downloads](https://nodejs.org/en/download) |
| Browser | JavaScript enabled, with support for ES modules, Fetch, `<dialog>`, and CSS Grid. |

The server uses built-in Node.js modules and Fetch. The frontend uses plain HTML, CSS, and JavaScript. Both editions run without third-party npm packages. The start and build commands use `--env-file-if-exists`, introduced in Node.js 22.9.0. [Node.js CLI documentation](https://nodejs.org/api/cli.html#--env-file-if-existsfile)

Clipboard buttons use the Clipboard API, so you can paste manually if browser permissions or the page's security context prevent clipboard access.

## Node.js edition

### Run the Node.js edition locally

1. Install Node.js and run `node --version` in a new terminal. On Windows, the official `.msi` installer can add Node.js to your PATH.
2. On GitHub, choose **Code → Download ZIP** and extract it. Open the folder containing `package.json`, `server.mjs`, and `public/`.
3. Use the launcher for your platform or run `npm start` from the project folder.

| Platform | Launcher |
| --- | --- |
| Windows | Double-click `start.cmd`. |
| macOS or Linux | Run `sh ./start.sh` in the project folder. |

The launchers check the Node.js version. On any platform, you can also start the server from the project folder using the command below.

```text
node --env-file-if-exists=.env server.mjs
```

Open <http://127.0.0.1:3210>, paste or load two deck lists, and select **Compare decks**. Keep the terminal open while using the app. Press **Ctrl+C** to stop the server.

The default mode works without an API key or a `.env` file. If Node.js reports `.env not found. Continuing without it.`, the app is using the default configuration. This edition uses its Node.js HTTP server to retrieve card data.

### Configuration

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

### Local cache

- `cache/cards/` stores card data and image URLs by source, language, and card ID.
- `cache/images/` stores full card images and banners as they are requested. Images with the same source URL share one cache file. If an image cannot be cached, your browser can load it from the official source.

Both caches persist across server restarts and have no expiration. The server requests missing entries on demand, including when you retry. The cache directory is created automatically and ignored by Git. To pick up official changes or reclaim disk space, stop the server, delete `cache/`, and restart.

### Official card data

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

### Deploy the Node.js edition

Deploy the project to a host that supports Node.js 22.9.0 or later and a long-running HTTP process. Use `npm start` as the start command. Set `HOST=0.0.0.0` if the host needs the process to listen on a network interface, and use the host's assigned `PORT` where applicable. Use HTTPS for browser clipboard support on a public deployment.

## Static edition

### Card data and images

The build downloads the latest English and Simplified Chinese catalogs from HearthstoneJSON. It writes the site, a manifest, and JSON files containing card IDs, localized names and text, mana costs, classes, reprint links, and image URLs to `dist/`. These records cover Zilliax modules and cosmetic choices. [HearthstoneJSON card data](https://hearthstonejson.com/docs/cards.html)

During comparison the browser loads the manifest and the relevant JSON files for the selected language from the site itself. It loads row illustrations and full card images on demand from HearthstoneJSON's image service. Card names, text, and comparisons remain available if the JSON loads and the image service is unreachable. [HearthstoneJSON image service](https://hearthstonejson.com/docs/images.html)

### Run the static edition locally

From the project folder, build with Node.js 22.9.0 or later, then serve `dist/` over HTTP. This example uses Python 3 as the static file server.

```sh
npm run build:pages
python3 -m http.server --bind 127.0.0.1 --directory dist 3211
```

Open <http://127.0.0.1:3211/>. If your Python 3 executable is named `python`, use it in place of `python3`. If `dist/` already contains a build, run just the server command. Rerun `npm run build:pages` to refresh the local catalog. To use another static host, upload the contents of `dist/` to its site directory.

### Publish the static edition to GitHub Pages

1. Make sure the [deployment workflow](.github/workflows/pages.yml) is on `main`, the default branch used by this project.
2. In the repository's **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.
3. Go to **Actions → Deploy static site to GitHub Pages → Run workflow** and select `main`. The workflow runs the tests, builds `dist/`, and publishes that directory. The default HearthstoneJSON build requires no credentials.
4. When deployment succeeds, open the URL shown under **Settings → Pages**. The project site for this repository is [lyzenghq.github.io/deckdiff-web](https://lyzenghq.github.io/deckdiff-web/).

The workflow is scheduled daily at 08:17 UTC (16:17 in Beijing). A manual run or a push to `main` that changes a watched file also triggers it. The workflow fetches the latest catalog available from the source. If the build fails, the site continues serving the last successful deployment. Review the catalog's copyright notice and applicable distribution terms before public deployment. [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow) · [Attribution and notices](NOTICE.md)

### Optional Battle.net build source

Set `PAGES_CARD_SOURCE=battlenet` for the static build. For local builds, add it and the Battle.net credentials to `.env`. For GitHub Pages, set `PAGES_CARD_SOURCE` under **Settings → Secrets and variables → Actions → Variables**, and add `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` as Actions secrets. The optional `BLIZZARD_REGION` variable defaults to `us`.

This build source uses Blizzard's official API data and image URLs. The 30-day snapshot expiry applies to Battle.net builds. If refreshes keep failing, replace or remove the published Battle.net snapshot before it expires. [Blizzard Developer API terms](https://www.blizzard.com/en-us/legal/a2989b50-5f16-43b1-abec-2ae17cc09dd6/blizzard-developer-api-terms-of-use)

## Features

- Paste raw deck codes or full in-game exports. Custom deck names from `###` headings are preserved.
- Compare decks side by side, sorted by mana cost and card name. Filter to changes, all cards, or shared cards, and see added, removed, and shared counts.
- Match editions using the card catalog's reprint links, including different editions of a sideboard's owner card. Card details show the original edition from each deck.
- View illustrations, full card images, and card text. The Node.js edition tries artwork from another official edition if a banner is missing. Zilliax modules and cosmetic choices can use a crop of their full card renders.
- Compare sideboards and modules by their owner card. They are excluded from main-deck totals, and Zilliax cosmetic choices have their own label.
- Load v1 deckstrings for Standard, Wild, Classic, and Twist, including older codes that omit the sideboard flag.
- Switch between English and Simplified Chinese. The interface, card details, and copied results follow your selection.
- Swap decks, load an example, paste or clear each input, and compare with **Ctrl / Cmd + Enter**.
- Copy quantity changes such as `-1 Fireball` and `+1 Pyroblast`. Removals come first, and swapping linked editions at the same quantity is omitted.
- Compare raw card IDs and quantities when card data is unavailable.

Similarity is the number of shared cards divided by the size of the larger main deck. Edition matching falls back to raw IDs when reprint links are unavailable. The tool compares deck composition. Legality depends on the current game rules.

## Tests

Run the test suite from the project folder.

```sh
npm test
```

The built-in tests cover deckstring parsing, quantities, sideboard ownership, invalid inputs, disk caching, OAuth, HTTP routes, the static build, and translation coverage. API tests use mock responses and run without credentials or internet access. [Release verification in Simplified Chinese](RELEASE_CHECK.md)

## Troubleshooting

- **Node.js is missing.** Install it, reopen the terminal, and verify that `node --version` works.
- **Node.js rejects `--env-file-if-exists`.** Upgrade to Node.js 22.9.0 or later.
- **The port is already in use.** For the Node.js edition, set another `PORT` in `.env`. For static preview, change `3211` in the HTTP server command. Open the URL with the new port.
- **Card names or images are missing.** Select **Retry loading** when the option appears. In the Node.js edition, check the server's connection to Blizzard. In the static edition, check that the host serves `data/manifest.json` and the corresponding JSON files from `dist/`. If only images are missing, check access to the source's image CDN.
- **The Paste button is unavailable.** Paste with **Ctrl / Cmd + V**. Use HTTPS for remote deployments.

## Project layout

```text
public/          Web UI, deckstring parsing, comparison, and translations
lib/cards.mjs    Official data providers, authentication, and card metadata cache
cache/           Runtime cache for card data and images
server.mjs       HTTP server and same-origin card proxy
scripts/         Static site builder and HearthstoneJSON adapter
dist/            Generated static site and published card data
.github/workflows/pages.yml  GitHub Pages build and deployment
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
