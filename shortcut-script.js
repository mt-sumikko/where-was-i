/*
 * where-was-i iOSショートカット用スクリプト
 *
 * ショートカットアプリの「Webページで実行」(Run JavaScript on Web Page)
 * アクションに貼り付けて使う。bookmarklet.jsと同じロジックだが、
 * クリップボードコピーや共有シートは使わず、生成したURLを
 * completion() でショートカットの次のアクションに渡す。
 *
 * ショートカットの組み方:
 *   1. 「現在のWebページを取得」(Get Current Webpage from Safari)
 *      ※ ショートカットの起動元(共有シート/ホーム画面/背面タップ等)によっては不要な場合もある
 *   2. 「Webページで実行」(Run JavaScript on Web Page) にこのスクリプトを貼る
 *   3. その出力(URLの文字列)を「メモに追加」(Add to Note) に渡し、
 *      対象メモをあらかじめ固定で指定しておく(例:「しおりメモ」)
 *   → これで共有シートを経由せず、ワンタップで決まったメモに自動追記される
 */
(function () {
  function normalize(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

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

  const node = findTopVisibleTextNode();
  if (!node) {
    completion('しおりURLの生成に失敗しました(ビューポート内にテキストが見つかりません)');
    return;
  }

  const fullText = normalize(node.textContent);
  const mainText = extractMainText(fullText, 20);
  const url = location.origin + location.pathname + location.search + '#:~:text=' + encodeURIComponent(mainText);

  completion(url);
})();
