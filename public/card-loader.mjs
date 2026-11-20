// SPDX-License-Identifier: GPL-2.0-only
export class CardLoadError extends Error {
  constructor(code, retryable = true) {
    super(code);
    this.name = 'CardLoadError'; this.code = code; this.retryable = retryable;
  }
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, {once: true});
  });
}

// Initial loads try once. A user-requested reload performs up to three
// attempts; each attempt gets a new timeout and aborts any unfinished batches.
export async function loadCardData({ids, locale, refresh = false, signal, onAttempt = () => {}, fetcher = fetch, wait = delay}) {
  const total = refresh ? 3 : 1;
  const chunks = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
  for (let attempt = 1; attempt <= total; attempt++) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const signals = [controller.signal, AbortSignal.timeout(25000)];
    if (signal) signals.push(signal);
    const attemptSignal = AbortSignal.any(signals);
    onAttempt({attempt, total});
    try {
      const batches = await Promise.all(chunks.map(async chunk => {
        const query = new URLSearchParams({ids: chunk.join(','), locale});
        let response;
        try { response = await fetcher(`/api/cards?${query}`, {cache: 'no-store', signal: attemptSignal}); }
        catch (error) {
          if (signal?.aborted) throw signal.reason;
          if (error.name === 'TimeoutError' || attemptSignal.reason?.name === 'TimeoutError') throw new CardLoadError('API_TIMEOUT');
          throw new CardLoadError('LOCAL_SERVER_UNAVAILABLE');
        }
        let data;
        try { data = await response.json(); }
        catch {
          if (signal?.aborted) throw signal.reason;
          throw new CardLoadError(attemptSignal.reason?.name === 'TimeoutError' ? 'API_TIMEOUT' : 'API_UNAVAILABLE');
        }
        if (!response.ok) {
          const code = data.code || 'API_UNAVAILABLE';
          throw new CardLoadError(code, code !== 'API_CONFIGURATION' && (response.status >= 500 || response.status === 429));
        }
        if (!Array.isArray(data.cards) || !Array.isArray(data.missing)) throw new CardLoadError('API_UNAVAILABLE');
        return data;
      }));
      signal?.throwIfAborted();
      return {cards: batches.flatMap(data => data.cards), missing: batches.flatMap(data => data.missing)};
    } catch (error) {
      controller.abort();
      if (signal?.aborted) throw signal.reason;
      if (attempt === total || error.retryable === false) throw error;
      await wait(500 * attempt, signal);
    }
  }
}
