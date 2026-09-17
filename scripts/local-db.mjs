import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Maintenance only: never imported by the Worker or browser.
export function localDatabase() {
  const directory = resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const files = readdirSync(directory).filter(
    (name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite',
  );
  if (files.length !== 1)
    throw new Error(
      'Expected exactly one local D1 database. Select the correct workspace first.',
    );
  const database = new DatabaseSync(resolve(directory, files[0]));
  database.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  return database;
}
