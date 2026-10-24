import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { log } from 'node:console';
const bundle = readFileSync('.cache/worker/worker.js','utf8');
if (/@tonaljs|src\/catalog|guitar\.json/.test(bundle)) throw new Error('OGP Worker must not initialize music dictionaries or the form catalog');
if (Buffer.byteLength(bundle) > 16 * 1024) throw new Error('Review OGP Worker growth beyond 16 KiB');
log(`OGP Worker: ${Buffer.byteLength(bundle)} bytes, no music dictionary or form catalog.`);
