// SPDX-License-Identifier: GPL-2.0-only
import {randomUUID} from 'node:crypto';
import {mkdir, rename, rm, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';

export async function writeCacheFile(file, data) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await mkdir(dirname(file), {recursive: true});
  try {
    await writeFile(temporary, data, {flag: 'wx'});
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, {force: true}).catch(() => {});
    throw error;
  }
}
