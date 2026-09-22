/*
 * where-was-i ブックマークレット版「しおりを挟む」
 *
 * index.html は自分自身のページ専用(#article配下だけを走査)だが、
 * こちらはブックマークバーに登録して任意のWebページ上で実行する版。
 * document.body全体を対象に、ビューポート内で一番上に見えるテキストから
 * text fragment URL(#:~:text=...)を組み立て、自前のCloudflare Workers API
 * (worker/index.js)にfetch()で直接送信する。画面遷移や他アプリの起動を
 * 一切挟まないため、iOSショートカット経由で繰り返し遭遇した不具合
 * (詳細はREADMEの「iOSショートカット版」参照)を回避できる。
 *
 * 使い方:
 *   1. worker/README等の手順でCloudflare Workers APIをデプロイする
 *   2. このファイル内の API_URL と AUTH_TOKEN を自分の環境の値に書き換える
 *   3. 内容を圧縮して "javascript:(function(){...})();" という1行のURLにし、
 *      ブラウザのブックマークのURL欄に登録する
 *   (圧縮済みのものは README.md に掲載。ただし API_URL/AUTH_TOKEN は
 *   プレースホルダーのままなので、貼り付けた後に必ず書き換えること)
 */
(function () {
  function normalize(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  // 冒頭maxLength文字までの範囲で、直近の句読点の直後まで切り詰める。
  // 単純な文字数カットだと単語/文節の途中で切れてtext fragmentのマッチに
  // 失敗しやすいことがindex.html側の検証で分かっているための対応。
  function extractMainText(fullText, maxLength) {
    const slice = fullText.slice(0, maxLength);
    const lastPunct = Math.max(
      slice.lastIndexOf('。'), slice.lastIndexOf('、'),
      slice.lastIndexOf('！'), slice.lastIndexOf('？'),
      slice.lastIndexOf('.'), slice.lastIndexOf(',')
    );
    if (lastPunct >= 3) return slice.slice(0, lastPunct + 1);
    return slice;
  }

  function isHidden(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0;
  }

  function findTopVisibleTextNode() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.textContent || !normalize(node.textContent)) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
          if (isHidden(parent)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    let best = null;
    let bestTop = Infinity;
    let node;
    while ((node = walker.nextNode())) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (const rect of rects) {
        if (rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) {
          if (rect.top < bestTop) {
            bestTop = rect.top;
            best = node;
          }
          break;
        }
      }
    }
    return best;
  }

  function showToast(msg, isError) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'background:' + (isError ? '#dc2626' : '#111827') + ';color:#fff;' +
      'padding:10px 16px;border-radius:8px;font-size:14px;line-height:1.5;' +
      'z-index:2147483647;box-shadow:0 4px 16px rgba(0,0,0,.35);' +
      'max-width:min(90vw,480px);word-break:break-all;font-family:sans-serif;';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 4000);
  }

  const node = findTopVisibleTextNode();
  if (!node) {
    showToast('しおり: ビューポート内にテキストが見つかりませんでした', true);
    return;
  }

  const fullText = normalize(node.textContent);
  const mainText = extractMainText(fullText, 20);
  const url = location.origin + location.pathname + location.search + '#:~:text=' + encodeURIComponent(mainText);

  // クリップボードコピーは保険として残す(API送信が失敗した場合に、
  // 手動で貼り付けられるようにするため)。
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).catch(function () {});
  }

  // Cloudflare Workers上の自前APIにfetch()で直接送信する。iOSショートカット
  // (shortcuts:// URLスキーム)経由の方式は、実機で「Webページで JavaScript
  // を実行」自体が機能しない不具合や、x-success経由でSafariに戻る際に
  // ショートカットの出力が勝手にURLへ付加されて壊れる不具合に繰り返し
  // 遭遇し、安定運用できなかった。fetch()は画面遷移を一切挟まないため、
  // その種の不具合が原理的に起こらない。
  //
  // 使う前に、以下2つを自分の環境の値に書き換えること:
  //   API_URL: `wrangler deploy` 後に発行されるWorkerのURL + "/save"
  //   AUTH_TOKEN: `wrangler secret put AUTH_TOKEN` で設定したのと同じ値
  var API_URL = 'https://YOUR_WORKER_SUBDOMAIN.workers.dev/save';
  var AUTH_TOKEN = 'YOUR_AUTH_TOKEN';

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': AUTH_TOKEN },
    body: JSON.stringify({ url: url }),
  }).then(function (res) {
    if (res.ok) {
      showToast('しおりを保存しました: 「' + mainText + '」');
    } else {
      showToast('保存に失敗しました(' + res.status + ')。URLはクリップボードにあります', true);
    }
  }).catch(function () {
    showToast('保存に失敗しました(通信エラー)。URLはクリップボードにあります', true);
  });
})();
