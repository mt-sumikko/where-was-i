# where-was-i
bookmark for web article with NFC

## これは何か

`index.html` 単体で動く、text fragment (`#:~:text=`) を使った「しおり」プロトタイプ。
ビルド不要。ブラウザで直接開くか、簡易HTTPサーバーで配信して動作確認できる。

NFCタグへのタッチの代わりに、画面下部固定の2つのボタンで操作する。

- **📍 しおりを挟む**: ビューポート内で一番上に見えているテキストを取得し、`#:~:text=` 形式のURLを組み立てて `localStorage` に保存する（生成されたURLはデバッグ用に画面下部に表示される）。
- **📖 しおりを開く**: 保存されたURLへ `location.href` で遷移し、ブラウザ標準のtext fragment機能によるスクロール＆ハイライトを試す。

「最大文字数」（10/15/20/30文字）と「前後の文脈も含める」（`prefix-,text,-suffix` 構文）はマッチ精度の検証用に画面上で切り替えられる。

## 動かし方

```bash
python3 -m http.server 8000
# ブラウザで http://localhost:8000/index.html を開く
```

**重要:** `file://` で直接開くと「しおりを開く」が機能しない（後述）。必ずHTTPサーバー経由で開くこと。

## ブックマークレット版（任意のWebページで使う）

`index.html` はこのリポジトリの中のページ専用（`#article` 配下だけを見る）だが、**`bookmarklet.js` は任意のWebページ上で「しおりを挟む」を実行できるブックマークレット版**。実際に読んでいるニュースサイトやブログの記事で試すにはこちらを使う。

やること自体は同じ（ビューポート内で一番上に見えるテキストを取得→句読点区切りで切り詰め→`#:~:text=` URLを組み立て）だが、保存先が `localStorage` ではなく**クリップボードへの自動コピー**になっている（他人のページに自分の`localStorage`を書き込むわけにはいかないので）。コピー直後、`shortcuts://run-shortcut?name=しおりメモ保存` というURLスキームで**iOSショートカット「しおりメモ保存」を自動起動**し、クリップボードの中身を決まったメモに無言で追記する（詳細は後述の「iOSショートカット版」を参照）。「しおりを開く」側はブックマークレット不要で、保存したURLをそのまま開けばよい（NFCタグに書き込む・メモから開く・自分に送る、など）。

### 登録方法

1. `bookmarklet.js` の中身をコピーし、ブラウザで開発者コンソール等を使って圧縮する必要はない。以下の圧縮済みコードをそのまま使う：

```
javascript:(function(){function normalize(text){return text.replace(/\s+/g,' ').trim();}function extractMainText(fullText,maxLength){const slice = fullText.slice(0,maxLength);const lastPunct = Math.max(slice.lastIndexOf('。'),slice.lastIndexOf('、'),slice.lastIndexOf('！'),slice.lastIndexOf('？'),slice.lastIndexOf('.'),slice.lastIndexOf(','));if(lastPunct >= 3)return slice.slice(0,lastPunct + 1);return slice;}function isHidden(el){if(!el)return false;const style = getComputedStyle(el);return style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity)=== 0;}function findTopVisibleTextNode(){const walker = document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(node){if(!node.textContent || !normalize(node.textContent))return NodeFilter.FILTER_REJECT;const parent = node.parentElement;if(!parent)return NodeFilter.FILTER_REJECT;const tag = parent.tagName;if(tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT')return NodeFilter.FILTER_REJECT;if(isHidden(parent))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}});let best = null;let bestTop = Infinity;let node;while((node = walker.nextNode())){const range = document.createRange();range.selectNodeContents(node);const rects = range.getClientRects();for(const rect of rects){if(rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight){if(rect.top < bestTop){bestTop = rect.top;best = node;}break;}}}return best;}function showToast(msg,isError){const el = document.createElement('div');el.textContent = msg;el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' + 'background:' +(isError ? '#dc2626':'#111827')+ ';color:#fff;' + 'padding:10px 16px;border-radius:8px;font-size:14px;line-height:1.5;' + 'z-index:2147483647;box-shadow:0 4px 16px rgba(0,0,0,.35);' + 'max-width:min(90vw,480px);word-break:break-all;font-family:sans-serif;';document.body.appendChild(el);setTimeout(function(){el.remove();},4000);}const node = findTopVisibleTextNode();if(!node){showToast('しおり:ビューポート内にテキストが見つかりませんでした',true);return;}const fullText = normalize(node.textContent);const mainText = extractMainText(fullText,20);const url = location.origin + location.pathname + location.search + '#:~:text=' + encodeURIComponent(mainText);var SHORTCUT_NAME = 'しおりメモ保存';function runShortcut(){var returnUrl = location.href;location.href = 'shortcuts://run-shortcut?name=' + encodeURIComponent(SHORTCUT_NAME)+ '&x-success=' + encodeURIComponent(returnUrl);}if(navigator.clipboard && navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){showToast('しおりをコピーしました:「' + mainText + '」');runShortcut();}).catch(function(){window.prompt('自動コピーに失敗しました。手動でコピーしてください:',url);});}else{window.prompt('しおりURL(手動でコピーしてください):',url);}})();
```

2. **Mac (Safari/Chrome)**: 適当なページをブックマークに追加 → ブックマーク編集画面を開き、URL欄を上記の `javascript:...` に丸ごと置き換える → 名前を「しおりを挟む」などにしておく。
3. **iPhone Safari**: 同様にまず普通にブックマークを1つ追加 → ブックマーク一覧の編集モードでそのブックマークを開き、URL欄を `javascript:...` に置き換える。
4. あらかじめ後述の「iOSショートカット版」の手順で、ショートカット「しおりメモ保存」を作っておく。
5. 実際に読みたいページを開いた状態で、ブックマークバー（またはブックマーク一覧）からこれを実行すると、画面下に「しおりをコピーしました: 「〇〇〇」」とトースト表示が出てtext fragment URLがクリップボードに入り、続けて自動でショートカットアプリが起動してメモに追記される。

### ダミーニュースサイトでの検証

`index.html` とは全く違うDOM構造（ヘッダー・ナビ・サイドバー広告・広告差し込みのある記事本文）を持つダミーのニュースサイト風ページを別途用意し、Playwrightでブックマークレットを注入して検証した。ヘッダーやサイドバー広告のテキストを誤って拾うことなく、記事本文中のビューポート最上部のテキストを正しく抽出し、クリップボードへのコピーまでは問題なく機能することを確認済み（`shortcuts://` へのカスタムスキーム遷移自体はheadless環境では検証できないため、そこから先はユーザー側での実機確認が必要）。

## iOSショートカット版（共有シートを経由せず特定のメモへ自動保存）

共有シートは結局「保存先を毎回選ぶ」手間が残り、普通の記事共有と体験が変わらない。**決まった1つのメモに無言で追記したい場合は、ブックマークレットではなくiOSショートカットに主導権を渡すのが確実。**

### 実機検証で判明した重大な制約：「Webページで JavaScript を実行」が機能しないケースがある

当初、`shortcut-script.js`（ショートカットの「Webページで実行」= Run JavaScript on Web Page アクションに貼り、`completion(url)` で結果を次のアクションに渡す版）で1つのショートカットに完結させる設計を試みた。手順としては：

1. 「現在のWebページを取得」or 共有シート経由で「Webページ」を受け取る
2. 「Webページで JavaScript を実行」に `shortcut-script.js` を貼る
3. 出力を「メモに追加」に渡す

という3ステップ構成。ロジック自体はPlaywright（`completion`をモック）で正しく動くことを確認済みだったが、**ユーザーの実機(iPhone)では「Webページで JavaScript を実行」の出力(`JavaScriptの結果`)が常に空になり、機能しなかった**。切り分けた内容：

- 背面タップ／ショートカットアプリから直接実行／共有シートからの実行、**3つの起動経路すべてで失敗**。
- `completion('テスト成功');` のような最小のコードに置き換えても失敗（クォート変換などコピペ起因の構文エラーではない）。
- 一方、同じ「Webページ」オブジェクトから **`Get Details of Safari Web Page`（Safari Webページの詳細を取得）でURLを取るのは問題なく成功した**。通知にもメモにも正しいURLが渡った。
- つまり「Webページ」オブジェクト自体は生きているのに、**「Webページで JavaScript を実行」というアクションだけが常に空を返す**、という状態。SafariのJavaScript設定はオン、機能拡張の設定にも該当項目なし。原因はこのiPhone固有の環境（地域設定・制限プロファイル・iOSバージョンなど）である可能性が高いが、特定には至らなかった。

**この不具合が特定の環境固有なのか、より広く起こりうるのかを事前に切り分ける手段がなかったため、「Webページで JavaScript を実行」に依存しない設計に切り替えた。** `shortcut-script.js` と、この節の以前の手順は「うまくいかなかった記録」として残しておく（同じアクションで同様の問題に当たった場合の参考用）。

### 採用した方式：ブックマークレット + クリップボード経由の2アクションだけのショートカット

`bookmarklet.js` 側でSafari上で直接JavaScriptを実行してtext fragment URLを生成し、クリップボードにコピー。その直後、`shortcuts://run-shortcut?name=...` というURLスキームで、Safari拡張機能を一切使わない**超シンプルな別のショートカット「しおりメモ保存」を自動起動**する。この方式なら「Webページで JavaScript を実行」を一切使わないため、上記の不具合を回避できる。

#### 1. ショートカット「しおりメモ保存」を作る

Safari関連のアクションは一切使わない、以下の2アクションだけ：

1. 「**クリップボードの内容を取得**」
2. 「**メモに追加**」— 入力に手順1の出力（クリップボードの内容）を渡し、**対象メモをあらかじめ固定で指定**（例:「Web しおり Where was i」）

ショートカット名は必ず「**しおりメモ保存**」にする（`bookmarklet.js` 内の `SHORTCUT_NAME` 定数と一致させる必要がある。名前を変える場合は両方を合わせて変更する）。

#### 2. `bookmarklet.js` の動き

`bookmarklet.js` は、クリップボードコピーに成功した直後、`location.href = 'shortcuts://run-shortcut?name=' + encodeURIComponent(SHORTCUT_NAME) + '&x-success=' + encodeURIComponent(returnUrl)` でショートカットアプリを自動起動する。ユーザー操作としては、ブックマークレットを1回タップするだけで、あとは自動的にショートカットが起動してメモに追記される想定（環境によっては初回に外部アプリを開く確認ダイアログが挟まる可能性がある）。

`x-success` パラメータには元のページのURLを渡している。これはiOSショートカットのURLスキームが対応するx-callback-url形式のパラメータで、**ショートカットの実行完了後に指定したURLへ自動で遷移して戻る**機能。これにより「ブックマークレットタップ→ショートカットアプリに切り替わったまま」ではなく「切り替わって実行完了後、自動でSafariの元のページに戻ってくる」という体験になる想定（`shortcuts://`の実際の遷移挙動を含め、iPhone実機での確認が必要）。

`shortcuts://` への遷移自体はカスタムURLスキームなのでheadless環境では検証できないが、その手前のクリップボードコピー部分はPlaywrightで動作確認済み。

#### 実機確認：完全に動作した

ユーザーの実機(iPhone)で、実際に外部サイト(anthropic.comの記事ページ)を開いた状態でブックマークレットを実行したところ、

1. トーストで「しおりをコピーしました: 「〇〇〇」」と表示
2. クリップボードにtext fragment URLがコピーされる
3. 自動で `shortcuts://` 遷移が発生し、ショートカットアプリに切り替わる
4. 「しおりメモ保存」ショートカットが実行される
5. **対象メモ「Web しおり Where was i」に、正しいtext fragment URL（`https://www.anthropic.com/engineering/...#:~:text=The%20Claude%20Agent%20SDK`）が追記される**

まで、一連の流れが最後まで動作することを確認済み。「Webページで JavaScript を実行」を経由しない設計に切り替えたことで、この環境固有の不具合を完全に回避できた。

なお、`しおりメモ保存` ショートカット内でも「クリップボードを取得」の出力をそのまま「メモに追加」に渡すと同じ型変換の問題（メモの更新日時だけ進み、中身が空のまま）が再発した。ここでも「テキスト」アクションでクリップボードの内容を一度明示的に固定してから「メモに追加」に渡すことで回避できた。`bookmarklet.js`側の「Webページで JavaScript を実行」の一件と合わせて、**iOSショートカットでは「他アプリ由来の値をアクションに直接渡すと空になる」系の型変換の不具合に何度か遭遇した**。同様の問題に当たった場合は、間に「テキスト」アクションを一つ挟んで値を固定するのが有効な回避策になりそう。

唯一の細かい注意点として、メモアプリの自動リンク検出が `#:~:text=` を含む長いURLをリンク化してくれない（プレーンテキストのまま保存される）ことがある。実害は小さく、テキストとしては正確に保存されているので、選択してコピー→Safariに貼り付ければ問題なく開ける。

### NFCタグが手元にない時のトリガー代替手段

NFCタグへのタッチは「ショートカットを起動するきっかけ」の1つでしかないので、他の起動方法でも核心ロジックの検証はできる：

- **ホーム画面にアイコン追加**（一番手軽）: ショートカット詳細画面の共有ボタン→「ホーム画面に追加」。アプリのようにワンタップで起動できる。
- **背面タップ (Back Tap)**: 設定 → アクセシビリティ → タッチ → 背面タップ で、本体背面を2回/3回叩いた時にショートカットを起動するよう割り当てられる。「軽く触れる/叩く→起動」という体感がNFCタッチに一番近いので、実機代替としてはこれが一番おすすめ。
- **Siri起動**: ショートカットに音声フレーズを設定し「Hey Siri、しおりを挟んで」で起動。
- **コントロールセンターにボタン追加**: 設定 → コントロールセンター →「ショートカット」を追加。コントロールセンターを開いてワンタップ。

NFCタグが手元に戻ってきたら、「オートメーション」タブで「NFCを読み取ったら」トリガーにこのショートカットを紐づければ、そのままタッチ運用に切り替えられる。

---

## 検証結果

実機はNFCタグの代わりにボタン操作、ブラウザは Chromium (Playwright / headless, `/opt/pw-browsers`) で自動検証した。加えて、ユーザー自身の手元Mac環境で Chrome / Safari 両方の実機確認を行ってもらい、**どちらもジャンプ＆ハイライトが正しく機能することを確認済み**。

### 1. Chrome/Chromiumでの動作確認

#### `file://` では「しおりを開く」がほぼ機能しない

最初の検証で、`file://` でページを開いた状態だと、同一URL（フラグメントのみ変更）への `location.href` 遷移も、`location.reload()` も、`window.open()` での新規タブオープンも、いずれも text fragment のスクロール＆ハイライトが発火しなかった（`window.scrollY` が常に `0`）。

一方、同じ手順を `http://localhost:8000/...` で行うと、**同一タブでのボタンクリック（`location.href`）でも新規タブでも問題なくジャンプ＆ハイライトされた**（スクリーンショットで黄色ハイライトを確認済み）。

→ Text Fragments は `file:` スキームではまともに動作しないとみなした方がよい。プロトタイプ確認・実機運用ともにHTTP(S)配信が前提になる。

#### 同一タブ内の `location.href` 遷移について

要件文には「同一ページ内リンクなのでリロードが発生する」とあったが、実際には**同一URLへの `location.href` 代入は same-document navigation（ハッシュ変更のみ）として扱われ、full navigationにならないケースがある**ことが分かった。ただしHTTP(S)配信下でPlaywright検証した限りでは、これでもtext fragment処理は正しく発火し、ハイライト・スクロールされた（`file://` のときだけ発火しなかった）。

NFC実機運用では、タグを読んだ瞬間にOSがブラウザを新規に起動する（＝常にfull navigation）想定になるはずなので、この差異は実運用上あまり問題にならないと考えられる。念のため実機統合時は、同一タブ内遷移よりも「新規タブ/新規ウィンドウとして開く」設計の方が安全。

#### 文字数とマッチ精度 — 句読点区切りが決定的に重要

最初の実装（冒頭から機械的にN文字を切り出すだけ）で検証したところ、**日本語では文字数を単純にカットすると高確率でマッチに失敗する**ことが分かった。

| 抽出文字列 | 結果 |
|---|---|
| `この前後文脈を含める`（10文字、「含める」で終わる自然な区切り） | ✅ 成功 |
| `この前後文脈を含める指定は、同`（15文字、「同じ」の途中で切れる） | ❌ 失敗（先頭に留まる＝未マッチ） |
| `...ページ内に複数回登`（30文字、「登場する」の途中で切れる） | ❌ 失敗 |
| `...ページ内に複数回登場するような記事では特に効果を発揮する。`（句点まで） | ✅ 成功 |

推測される原因は、ブラウザのtext fragmentマッチングが（内部的に）単語・文節境界を要求しており、活用語や助詞の途中で切れた文字列は「単語境界にならない」としてマッチ対象から外れること。英語のようにスペース区切りの言語では起きにくいが、分かち書きしない日本語では単純な文字数カットは相性が悪い。

**対策として、`index.html` 側の抽出ロジックを「指定した最大文字数以内で、直近の句読点（`。` `、` `！` `？`）の直後まで切り詰める」方式に変更した。** これにより10/15/20/30文字のいずれの設定でも、スクロール位置(約±300〜500pxの誤差=段落単位のズレ)を含めて全ケースで正しくマッチするようになった（誤差は「保存時にビューポート内で見ていた行」と「マッチ後にブラウザがスクロールする段落の先頭」の違いによるもので、マッチ失敗ではない）。

前後文脈（`prefix-,text,-suffix`）ありのケースも同様に、区切り位置が不自然だと失敗しやすい。今回はメインテキストのみ句読点境界に対応し、prefix/suffix（前後15文字固定）は未対応のまま残した。より厳密にやるなら、prefix/suffixも文節境界にスナップする、あるいは適応的に長さを調整する改善余地がある。

#### 広告挿入などレイアウト変化への耐性

しおり保存後、記事冒頭に高さ600pxのダミー広告ブロックを挿入した別HTMLに対して、保存済みの同じtext fragment URLでアクセスするテストを行った。ピクセルベースのスクロール位置だと当然ズレるはずだが、**text fragmentはDOM構造やスクロール位置に依存せず「見えているテキスト内容」でマッチするため、広告分レイアウトがずれても正しく同じ文章の位置までジャンプ＆ハイライトされた**（スクリーンショットで確認済み）。

これは text fragment 方式の大きな強みで、要件にあった「動的にレイアウトが変わる場合の強度」については良好な結果と言える。ただし以下のケースには弱い：

- **テキスト内容自体が変わる場合**（A/Bテストで書き出しが変わる、動的に挿入された文言がしおり対象になっていた等）は当然マッチしない。この場合ブラウザは通常のアンカー遷移同様ページ先頭を表示するだけで、エラーにはならず「静かに失敗」する。
- **無限スクロールなどでDOMに未読み込みの場合**、マッチ対象がまだ存在しないため失敗する可能性が高い。
- **同じ文字列がページ内に複数箇所ある場合**、特に短い文字数だと意図しない箇所にマッチする可能性がある。前後文脈オプションはこのリスクを下げるためのものだが、上記の通り区切り位置の精度がより重要になる。

### 2. Safari (Mac) — 実機確認済み

本セッションの実行環境にはSafari実機・シミュレータが無いため自動検証はできなかったが、ユーザーが手元のMacでSafari実機での動作を確認済み。**httpサーバー経由で配信した状態で、しおりを挟む→開くの一連の流れが正しく機能し、ジャンプ＆ハイライトされることを確認した。**

参考として一般に知られている仕様情報も残しておく：

- Safariは macOS Ventura / iOS 16.1（2022年秋）以降でText Fragmentsの基本的なサポートが入っているとされる。
- Chromeに比べて仕様準拠度・安定性で後れを取っているという報告もあるが、デフォルト設定（15文字・句読点区切り）での基本動作では特に問題は見られなかった。前後文脈オプションなど細かい設定の組み合わせまでは未確認。
- iOS Safari（iPhone実機）は、GitHub Pagesで公開したページに対してユーザーが実機確認済み。しおりを挟む→開くの一連の流れ、および広告挿入・NFCタグ実機での動作まで含めて問題なく機能した（詳細は後述の「NFC実機への展開について」を参照）。

---

## NFC実機への展開について

要件にあった前提「タッチ→JS実行→URL生成→保存」の中核ロジックは、このプロトタイプのボタン部分をNFCタッチイベントに差し替えるだけでそのまま使い回せる。具体的には：

- `findTopVisibleTextNode()` → `extractMainText()` → URL組み立て → 保存、という一連の処理はDOM/JS完結で、NFCの有無に依存しない。
- 保存先を `localStorage` からサーバー、あるいはNFCタグ自体の書き込み領域に差し替えるのは、この検証の範囲外の話として独立して拡張できる。
- 実機では基本的にOSがブラウザを新規起動する形になり、常にfull navigationになるはずなので、今回見つかった「同一タブ内遷移が効かないことがある」問題はそのままでは顕在化しにくいと考えられる（念のため実機側でも確認要）。
- `file://` では機能しないため、実運用は必ずHTTP(S)で配信されたページが前提になる。

### NFCタグ実機(NFC Tools + 手持ちのNTAGタグ)での検証

ユーザーが実際にNTAGタグ(実効容量137バイト)へ、GitHub Pagesで公開したページ( `https://mt-sumikko.github.io/where-was-i/` )のtext fragment URLを書き込む検証を行った。

分かったこと:

- **ドメイン込みの絶対URLはそれだけでタグ容量をかなり消費する。** `https://mt-sumikko.github.io/where-was-i/#:~:text=` の時点で素の文字列は50バイトあり、137バイトのタグだと本文（マッチ対象のテキスト）に使える余地は日本語で10文字前後しか残らない。
- そのため、**`index.html` 側に「NFCタグ容量目安(バイト)」を指定できるフィールドを追加し、生成したURLがその容量を超える場合は自動で「前後文脈をオフ→文字数を1文字ずつ削る」の順に縮めて容量内に収める仕組みを実装した。** 137バイト指定で試したところ、容量無制限なら176バイトになるテキストが自動的に131バイト(10文字)まで削られ、かつtext fragmentとしても正しくジャンプ＆ハイライトすることを確認済み。
- 容量を増やしたい場合は、NTAG215(504バイト)やNTAG216(888バイト)などより大容量のタグに交換すれば単純に解決する。今回の仕組み自体はタグの容量に関わらず動くので、「容量目安の数値を変えるだけ」で対応できる。

## 既知の制限・今後の課題

- prefix/suffixの境界も句読点区切りに対応させると、前後文脈オプションの成功率がさらに上がる見込み。
- 「マッチ失敗時のフォールバック」（例: 見つからなければページ先頭にとどまるだけで無言で終わる）をUI側でユーザーに伝える仕組みが無い。実運用では検討が必要。
- iOSショートカットの「Webページで JavaScript を実行」アクションが、ユーザーの実機で原因不明のまま機能しなかった（詳細は「iOSショートカット版」参照）。クリップボード経由の2段階方式（ブックマークレット + `shortcuts://` 自動起動 + シンプルなショートカット）に切り替えたところ実機で完全動作した。根本原因は未解明のままだが、実用上の回避策は確立できた。
- メモアプリの自動リンク検出が `#:~:text=` を含む長いURLをリンク化しない（プレーンテキストとして保存される）。実害は小さい（テキストとしては正確に保存される）が、気になるなら改善の余地あり。
