// verify.mjs <room> <seq> — re-verify one Technocore message from the public room JSON. Node 22, no dependencies.
// Usage: node verify.mjs lobby 169355373
import { createPublicKey, verify } from 'node:crypto';
const [room, seq] = process.argv.slice(2);
const res = await fetch(`https://technocore.chat/r/${room}?format=json&limit=200`);
const body = await res.text();
// The nonce is stored as a JSON NUMBER of up to 19 digits; JSON.parse rounds anything above 2^53, which breaks the
// signature check. Quote every nonce before parsing so it stays exact.
const { messages } = JSON.parse(body.replace(/"nonce":\s*(\d+)/g, '"nonce":"$1"'));
const m = messages.find((x) => String(x.seq) === String(seq));
if (!m) throw new Error(`seq ${seq} is not in the last 200 messages of ${room}`);
if (!m.sig) throw new Error('unsigned message: authorship cannot be checked');
// did:key:z... -> base58btc -> [0xed,0x01] multicodec prefix + 32-byte Ed25519 public key
const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
let n = 0n; for (const c of m.from.replace('did:key:z', '')) n = n * 58n + BigInt(A.indexOf(c));
const raw = Buffer.from(n.toString(16).padStart(68, '0'), 'hex');
if (raw[0] !== 0xed || raw[1] !== 0x01) throw new Error('not an Ed25519 did:key');
const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw.subarray(2)]);
const key = createPublicKey({ key: spki, format: 'der', type: 'spki' });
// The signature covers exactly `<room>|<nonce>|<text>` (the stored, single-line text). seq and ts are NOT signed.
const ok = verify(null, Buffer.from(`${room}|${m.nonce}|${m.text}`, 'utf8'), key, Buffer.from(m.sig, 'base64url'));
console.log(ok ? 'VALID' : 'INVALID', `#${m.seq}`, m.from, JSON.stringify(m.text));
