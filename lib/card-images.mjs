// SPDX-License-Identifier: GPL-2.0-only
import {createHash} from 'node:crypto';
import {readFile, stat} from 'node:fs/promises';
import {join} from 'node:path';
import {writeCacheFile} from './cache.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_BYTES = 8 * 1024 * 1024;

// The CDN can serve JPEGs with a .png suffix or label images as octet-stream.
function imageContentType(body) {
  if (body.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return 'image/jpeg';
  if (body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (body.toString('ascii', 4, 8) === 'ftyp' && ['avif', 'avis'].includes(body.toString('ascii', 8, 12))) return 'image/avif';
  return null;
}

export class CardImageCache {
  constructor({directory, fetcher = fetch}) {
    this.directory = directory;
    this.fetcher = fetcher;
    this.pending = new Map();
  }

  async load(source) {
    const url = new URL(source);
    if (url.origin !== 'https://d15f34w2p8l1cc.cloudfront.net' || !url.pathname.startsWith('/hearthstone/')) return null;
    url.hash = '';
    const key = createHash('sha256').update(url.href).digest('hex');
    const file = join(this.directory, `${key}.img`);
    if (!this.pending.has(file)) {
      const task = this.readOrDownload(url, file).catch(() => null).finally(() => this.pending.delete(file));
      this.pending.set(file, task);
    }
    return this.pending.get(file);
  }

  async readOrDownload(url, file) {
    try {
      const info = await stat(file);
      if (info.isFile() && info.size > 0 && info.size <= MAX_BYTES) {
        const body = await readFile(file);
        const contentType = imageContentType(body);
        if (contentType) return {contentType, body};
      }
    } catch { /* A missing or unreadable cache file can be downloaded again. */ }

    const response = await this.fetcher(url, {redirect: 'error', signal: AbortSignal.timeout(10000)});
    if (!response.ok || Number(response.headers.get('content-length')) > MAX_BYTES) {
      await response.body?.cancel();
      return null;
    }
    if (!response.body) return null;
    let length = 0;
    const chunks = [];
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > MAX_BYTES) return null;
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks, length);
    const contentType = imageContentType(body);
    if (!contentType) return null;
    await writeCacheFile(file, body).catch(() => { /* Serve the image even if caching fails. */ });
    return {contentType, body};
  }
}
