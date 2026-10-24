# SNS共有カード（ADR-061 / AC-68〜AC-76）

正本：[Notion 第12.13節](https://app.notion.com/p/3ff69357608b800f9731f2ff3f23f1e3)。2026-10-25にADR-060・061、第12.12・12.13節を照合。

## 配信と設計

`wrangler.jsonc` の `main=src/worker.ts`、`assets.binding=ASSETS`、`run_worker_first=["/"]` により、ルートHTMLだけにWorkerを先行させます。SPA fallback、Custom Domain、Workers Buildsは維持します。JS/CSS/画像/ヘルプは静的配信です。

WorkerはASSETSのHTMLを取得し、HTMLRewriterでtitle/descriptionを更新してOGPとTwitterタグを1セット挿入します。ブラウザ/Botに同じHTMLを返します。HEADは同じヘッダー・空の本文。他のメソッドは静的配信へ委譲します。ASSETSのセキュリティヘッダーを保持し、書き換えたHTMLは `Cache-Control: no-store`。元HTMLのETag/Last-Modified/Content-Lengthを除き、条件付きGETやRangeで静的シェルの304/206を返さないようにします。クエリを含む共有URLを `og:url` に保持します。

既存パーサーの構文部分を `src/domain/input.ts`、既存のURL v1構文を `src/state/url-syntax.ts`、数値/出典URLの検証を `song-fields.ts` に分離しました。元のエクスポートを維持してアプリ側も同じ処理を使います。WorkerにはフォームDBもTonal辞書も読み込みません。`deploy:check` ではバンドル16 KiB以下と依存混入を検査します。外部fetch、DB、API、認証は追加していません。

コード数は元表記一致で重複排除。Db/C#を分け、括弧内カンマ・分数コードを保持し、NC/N.C.は別の存在フラグにします。capoはURL値、移調はsourceShift+shift。formsの構文は検証しますが、候補登録・演奏コードへの帰属・同音競合は従来どおりReactで判断します。構文上有効な未登録フォームでOGPを汎用化しません。

無効URLは汎用メタデータに戻し、HTTP 200の既存アプリを配信します。タイトルの制御/書式文字・改行を除去し、80 Unicodeコードポイント超は末尾に「…」。HTML/属性は安全にエスケープします。元の曲名・共有URL・Reactのタブ名は切り詰めません。

## 再生成・検証

`public/og.png` は1200×630 PNG。WindowsのPowerShell 7とYu Gothicで、リポジトリルートから `pwsh -File scripts/generate-og.ps1` を実行して再生成できます。外部サービス不要です。フォントの環境差で文字の描画が多少変化する場合があります。生成画像は目視確認済みです。

```sh
pnpm build
pnpm dev:worker
# http://127.0.0.1:8787/?v=1&codes=C,G&mode=shape&title=流星群
```

別ターミナルで `pnpm test:ogp` を実行する場合は先にdev:workerを停止してください。テストが専用Wranglerローカルランタイムを起動・終了します。Vite dev/previewではOGP注入を検証できません。

|受け入れ条件|自動検証|
|---|---|
|AC-68 タイトル|JSなしHTTP GET、Discord/Twitter/ブラウザUAで同じtitle/OG/Twitter|
|AC-69 コード数|同名重複、Db/C#、括弧内カンマ、分数、NCのみ、inline/form競合・未登録|
|AC-70 設定|カポ0/1/12、sourceShift+shift、符号付き合計|
|AC-71 画像|200、image/png、PNG署名とIHDR 1200×630、絶対HTTPS画像URL|
|AC-72 fallback|必須不足、v、空要素、構文、重複競合、不正UTF-8/パーセント、数値範囲、長さ、src/forms|
|AC-73 安全性|引用符/HTML/日本語/絵文字、改行・制御除去、80コードポイント|
|AC-74 URL/キャッシュ|A/B/A連続取得、query保持、条件付き/Range GET、no-store、Workerからブラウザ起動・再読込|
|AC-75 非回帰|JS/CSS/favicon/仕様書/SPA、CSP/Referrer-Policy等、ルート限定設定、既存URL・全E2E|
|AC-76 品質ゲート|型、lint、単体、catalog/diff、URL互換/計測、build、Wrangler dry-run、OGP、E2EをCIで実行|

`pnpm test:ogp` の結果は `.cache/ogp-report.json`、GitHub ActionsのArtifactにも保存します。本番への同じHTTP検証は `OGP_BASE_URL=https://chords.kani3camp.com pnpm test:ogp`（PowerShellでは `$env:OGP_BASE_URL='https://chords.kani3camp.com'` を先に設定）。本番URLに対するテストも外部ページ取得や書き込みは行いません。

2026-10-25のローカル結果：型・lint・単体64件・URL互換17件・カタログ3,351フォーム/693和音ID・互換diff・URL長計測・build・Wrangler dry-runが成功。OGP 7件、既存E2E 48件（Chromium PC/タブレット、WebKitタブレット、Edge PC）が成功。Worker生成物は11,509 bytes（gzip約3.95 KiB）で、音楽理論辞書・フォームDBの混入なし。

例：`codes=C,G,C,Db,C#,C7(b9,#11),N.C.&capo=1&sourceShift=-1&shift=0` なら「使用コード5種類 + N.C.｜カポ1｜移調−1｜好きな押さえ方でギターコードを一覧表示。」。

## 運用と確認範囲

PRのQuality checks成功後にmainへマージし、既存Workers Buildsで自動デプロイします。GitHub Actionsから本番デプロイしません。本番HTTPとPNGを確認できた時点で公開検証済みとし、PR/CI/公開結果はNotion第12.13.5節へ記録します。Discord実投稿は投稿先・接続がある場合だけ行います。

静的アセット配信に対して、ルートHTMLはWorker invocationを使います。Freeの100,000要求/日・CPU 10ms/要求が上限で、バンドル縮小は本番CPU計測の代替にはなりません。上限到達時の挙動は実アクセスで負荷をかけて確認していません。SNS側のキャッシュ更新・表示省略、Safari/iPad実機は自動HTTP試験の保証範囲外です。

公式仕様（2026-10-25照合）：[Static Assets binding/routing](https://developers.cloudflare.com/workers/static-assets/binding/)、[headers](https://developers.cloudflare.com/workers/static-assets/headers/)、[HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/)、[limits](https://developers.cloudflare.com/workers/platform/limits/)。
