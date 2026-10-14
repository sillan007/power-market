/**
 * 나눔의 자리 - 푸시 알림 서버 (Cloudflare Workers 무료 플랜용)
 *
 * 하는 일: 앱에서 "새 글이 올라왔어요"라고 알려 오면, 알림을 켜 둔 성도들의 핸드폰/컴퓨터로
 *          웹 푸시 알림을 보냅니다. (앱이 꺼져 있어도 화면 상단에 알림이 떠요)
 *
 * 설정(Cloudflare 대시보드 → 이 Worker → 설정 → 변수 및 비밀):
 *   VAPID_PUBLIC   (텍스트)  vapid-keys.html 에서 만든 "공개 키"
 *   VAPID_PRIVATE  (비밀)    vapid-keys.html 에서 만든 "비공개 키"   ← 절대 공개 금지
 *   VAPID_SUBJECT  (텍스트)  예: mailto:내이메일@gmail.com
 *   ALLOWED_ORIGIN (텍스트)  예: https://내아이디.github.io   (경로 없이 주소 앞부분만)
 *   FIREBASE_PROJECT_ID (텍스트, 선택)  비워 두면 아래 DEFAULT_PROJECT 를 씁니다.
 */

const DEFAULT_PROJECT = 'power-market-f9573';
const MAX_IDS = 2;                    // 한 번 요청에 처리할 사람 수 (무료 플랜 CPU 10ms 제한 때문에 작게 유지)
const MAX_AGE = 15 * 60 * 1000;       // 올라온 지 15분 지난 글은 알림을 보내지 않음
const enc = new TextEncoder();

// ---------- 작은 도구들 ----------
function b64uToBytes(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64u(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function concat(...arrs) {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// ---------- 웹 푸시 암호화 (RFC 8291, aes128gcm) ----------
export async function encryptPayload(sub, plaintext, opts = {}) {
  const uaPub = b64uToBytes(sub.keys.p256dh);   // 받는 기기의 공개 키 (65바이트)
  const auth = b64uToBytes(sub.keys.auth);      // 받는 기기의 인증 비밀 (16바이트)
  const asKeys = opts.asKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPub, asPub);
  const ikm = await hkdf(auth, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const padded = concat(plaintext, new Uint8Array([2]));      // 마지막 레코드 표시(0x02)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, padded));
  const rs = new Uint8Array([0, 0, 16, 0]);                   // 레코드 크기 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

// ---------- VAPID 서명 (RFC 8292) ----------
async function vapidHeader(endpoint, env, cache) {
  const aud = new URL(endpoint).origin;
  if (cache[aud]) return cache[aud];
  const pub = b64uToBytes(env.VAPID_PUBLIC);
  const jwk = { kty: 'EC', crv: 'P-256', x: bytesToB64u(pub.slice(1, 33)), y: bytesToB64u(pub.slice(33, 65)), d: env.VAPID_PRIVATE, ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = bytesToB64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = bytesToB64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body)));
  return (cache[aud] = 'vapid t=' + head + '.' + body + '.' + bytesToB64u(sig) + ', k=' + env.VAPID_PUBLIC);
}

// ---------- Firestore REST (보안 규칙이 열려 있어 로그인 없이 접근) ----------
function fsBase(env) { return 'https://firestore.googleapis.com/v1/projects/' + (env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT) + '/databases/(default)/documents'; }
function fromValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return undefined;
}
function fromFields(fields) { const o = {}; for (const k in fields) o[k] = fromValue(fields[k]); return o; }
async function getDoc(env, path) {
  const res = await fetch(fsBase(env) + '/' + path);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('firestore ' + res.status);
  return fromFields((await res.json()).fields || {});
}
// 같은 글·같은 사람에게 알림이 두 번 가지 않도록 "이미 보냄" 표시를 만든다 (이미 있으면 false)
async function claim(env, markerId) {
  const res = await fetch(fsBase(env) + '/meta?documentId=' + encodeURIComponent(markerId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { at: { integerValue: String(Date.now()) } } })
  });
  if (res.status === 409) return false;
  if (!res.ok) throw new Error('firestore ' + res.status);
  return true;
}
async function removeSub(env, userId) {
  await fetch(fsBase(env) + '/users/' + encodeURIComponent(userId) + '?updateMask.fieldPaths=pushSub', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {} })
  });
}

// ---------- 응답 도구 ----------
function corsHeaders(env) {
  let origin = '*';
  if (env.ALLOWED_ORIGIN) { try { origin = new URL(env.ALLOWED_ORIGIN).origin; } catch (e) { origin = env.ALLOWED_ORIGIN; } }
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
}
function json(obj, status, headers) { return new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers) }); }

// ---------- 한 사람에게 보내기 ----------
async function notifyOne(env, ctx) {
  const { id, itemId, item, payload, asKeys, jwtCache } = ctx;
  if (id === item.giverId) return 'skip-author';
  const num = id.replace(/\D/g, '');
  if (!(await claim(env, 'n_' + itemId + '_' + num))) return 'duplicate';
  const user = await getDoc(env, 'users/' + encodeURIComponent(id));
  if (!user || !user.pushSub || user.blocked) return 'skip-no-subscription';
  let sub;
  try { sub = JSON.parse(user.pushSub); } catch (e) { return 'skip-bad-subscription'; }
  if (!sub || !/^https:\/\//.test(sub.endpoint || '') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return 'skip-bad-subscription';
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(payload)), { asKeys });
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, env, jwtCache),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high'
    },
    body
  });
  if (res.status >= 200 && res.status < 300) return 'sent';
  if (res.status === 404 || res.status === 410) { await removeSub(env, id); return 'removed-expired'; }
  return 'failed-' + res.status;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // 주소창에서 열어 보면 설정 상태를 알려 줍니다 (설정 확인용)
    if (request.method === 'GET') {
      return json({
        ok: true, service: 'nanum-push',
        configured: { VAPID_PUBLIC: !!env.VAPID_PUBLIC, VAPID_PRIVATE: !!env.VAPID_PRIVATE, VAPID_SUBJECT: !!env.VAPID_SUBJECT, ALLOWED_ORIGIN: !!env.ALLOWED_ORIGIN },
        project: env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT
      }, 200, cors);
    }
    if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, cors);
    if (!env.VAPID_PUBLIC || !env.VAPID_PRIVATE || !env.VAPID_SUBJECT) return json({ ok: false, error: 'VAPID 변수가 설정되지 않았어요' }, 500, cors);

    let body;
    try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400, cors); }
    const itemId = body && body.itemId, ids = body && body.ids;
    if (typeof itemId !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(itemId)) return json({ ok: false, error: 'bad itemId' }, 400, cors);
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_IDS || !ids.every(x => typeof x === 'string' && /^선민\d{1,6}$/.test(x))) return json({ ok: false, error: 'bad ids' }, 400, cors);

    try {
      const item = await getDoc(env, 'items/' + itemId);
      if (!item) return json({ ok: false, error: 'item not found' }, 404, cors);
      const age = Date.now() - Number(item.createdAt || 0);
      if (age > MAX_AGE || age < -5 * 60 * 1000) return json({ ok: false, error: 'item too old' }, 403, cors);

      const payload = {
        title: '나눔의 자리',
        body: (item.category === 'ask' ? '🙏 새 요청: ' : '🎁 새 나눔: ') + String(item.title || '').slice(0, 60),
        itemId
      };
      const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
      const jwtCache = {};
      const out = await Promise.all(ids.map(id =>
        notifyOne(env, { id, itemId, item, payload, asKeys, jwtCache }).catch(e => 'error: ' + (e.message || e))
      ));
      const results = {};
      ids.forEach((id, i) => { results[id] = out[i]; });
      return json({ ok: true, results }, 200, cors);
    } catch (e) {
      return json({ ok: false, error: String(e && e.message || e) }, 502, cors);
    }
  }
};
