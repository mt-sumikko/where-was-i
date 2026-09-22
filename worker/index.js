/*
 * where-was-i しおり保存API (Cloudflare Workers)
 *
 * ブックマークレットからのfetch()を直接受け、しおりURLをKVに保存する。
 * 画面遷移(ショートカットアプリの起動)を一切挟まないための仕組み。
 *
 * エンドポイント:
 *   POST /save  { url: "https://...#:~:text=..." }  ヘッダ X-Auth-Token 必須
 *   GET  /list  ?token=...                            保存済み一覧をJSONで返す
 *
 * 認証: 固定トークンをヘッダ/クエリで照合するだけのシンプルな方式。
 * トークン自体はコードに書かず、`wrangler secret put AUTH_TOKEN` で
 * Cloudflare側にのみ保存する(このファイルにもリポジトリにも残さない)。
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Auth-Token',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// トークン全体を晒さずに済むよう、先頭/末尾数文字だけ見せる
function preview(t) {
  if (!t) return null;
  if (t.length <= 12) return '*'.repeat(t.length);
  return t.slice(0, 6) + '...' + t.slice(-6);
}

// 2つの文字列を比較し、最初に食い違う位置のインデックスを返す(一致ならnull)
function firstDiffIndex(a, b) {
  if (a == null || b == null) return -1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i;
  }
  return null;
}

function isAuthorized(request, url, env) {
  const headerToken = request.headers.get('X-Auth-Token');
  const queryToken = url.searchParams.get('token');
  const token = headerToken || queryToken;
  // DEBUG: トークン不一致の原因切り分け用。原因が分かったら削除すること。
  console.log('DEBUG auth check', {
    receivedLength: token ? token.length : null,
    expectedLength: env.AUTH_TOKEN ? env.AUTH_TOKEN.length : null,
    receivedPreview: preview(token),
    expectedPreview: preview(env.AUTH_TOKEN),
    firstDiffIndex: firstDiffIndex(token, env.AUTH_TOKEN),
    match: token === env.AUTH_TOKEN,
  });
  return !!env.AUTH_TOKEN && token === env.AUTH_TOKEN;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // 認証チェックを最初に行い、不正なリクエストでKVの書き込み/読み取り
    // クォータを消費しないようにする(Freeプランの上限保護にもなる)。
    if (!isAuthorized(request, url, env)) {
      return json({ error: 'unauthorized' }, 401);
    }

    if (url.pathname === '/save' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: 'invalid json' }, 400);
      }
      if (!body || typeof body.url !== 'string' || !body.url) {
        return json({ error: 'url is required' }, 400);
      }
      const key = 'bookmark:' + Date.now();
      await env.BOOKMARKS.put(key, JSON.stringify({
        url: body.url,
        savedAt: new Date().toISOString(),
      }));
      return json({ ok: true });
    }

    if (url.pathname === '/list' && request.method === 'GET') {
      const list = await env.BOOKMARKS.list({ prefix: 'bookmark:' });
      const items = [];
      for (const k of list.keys) {
        const raw = await env.BOOKMARKS.get(k.name);
        if (raw) items.push(JSON.parse(raw));
      }
      items.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
      return json(items);
    }

    return json({ error: 'not found' }, 404);
  },
};
