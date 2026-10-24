# ギターコード一覧

曲に登場するコードを、選んだ押さえ方で一画面に並べる練習用アプリです。曲はクエリURLだけで保存・復元・共有し、ブラウザにはコードごとの好みだけを保存します。アカウント・API・DBは不要です。

仕様は [Notion](https://app.notion.com/p/3ff69357608b800f9731f2ff3f23f1e3)、視覚デザインは [Claude Design](https://claude.ai/chat/1eac386c-aa62-4893-b52d-b6a6c94ef241?artifact=35c7675d-9688-48c5-95b1-5147e9a77245)。参照版・実装差分は `docs/design/reference.md`。

## ローカル起動

Node.js 24 / pnpm 10.33.0を使用します。`.node-version` / `.nvmrc` / `packageManager` で固定。

```sh
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

表示先はターミナルに出る `http://127.0.0.1:5173/`。既に利用中ならViteが空きポートを選びます。

```sh
pnpm build
pnpm preview
```

ビルド済みの本番相当表示は `http://127.0.0.1:4173/`。外部サービスへの接続や環境変数・APIキーは不要です。データは監査済み生成物を同梱し、最初のコード入力または共有URL／好みの読み込みで別チャンクを読み込みます。コード譜サイトへの自動アクセスは行いません。

## 検証

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:catalog
pnpm test:url-compat
pnpm catalog:diff
pnpm measure:url
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:e2e
pnpm deploy:check
```

E2EはChrome相当のChromium、インストール済みMicrosoft Edge、WebKitでPC・タブレット幅を検証します。Edge未導入の環境は `pnpm exec playwright install msedge` が必要です。GitHub ActionsはLinuxで必要ブラウザを導入します。

GitHub Actionsの「Quality checks」は `main` へのpush、pull request、手動実行で起動します。型・lint・単体・カタログ・URL互換・ビルド・Cloudflare dry-run・ブラウザE2Eを検証し、結果と画面画像をArtifactへ保存します。CIから本番へのデプロイは行いません。

実行結果・検証の範囲は `docs/verification.md`、収録範囲は `docs/coverage.json`、全フォームの監査・隔離結果は `docs/catalog-report.json`。フォームDBの再生成方法は `docs/data-provenance.md`。

## Cloudflareへデプロイする場合

**このリポジトリ作成時点ではデプロイ・DNS変更は行っていません。** `wrangler.jsonc` はWorkers Static AssetsとCustom Domain `chords.kani3camp.com` に設定済みです。

```sh
pnpm build
pnpm exec wrangler login
pnpm exec wrangler deploy
```

`deploy:check` はdry-runで外部配信を行いません。実デプロイ時には対象のCloudflareアカウントを選び、既存の同名DNSレコードとの競合を確認してください。

Workers Buildsで自動配信する場合はGitHub `kani3camp/chords` の `main` を接続し、次の設定を使います。

- ビルド: `pnpm install --frozen-lockfile && pnpm build`
- デプロイ: `pnpm exec wrangler deploy`
- Node: 24 / pnpm: packageManager指定の10.33.0
- Preview buildsはOFF、本番のみ。GitHub Actionsからデプロイしません。

ブランチ保護でCI成功を必須とする設定とCloudflare Git連携は、リモートサービス側で実施する残作業です。ローカルの `_headers` はWrangler / Cloudflare配信時に適用され、Vite previewはヘッダー適用を模擬しません。独自ドメインでの実アクセスとSafari実機の最終確認は公開時に行ってください。

## URLと操作

公開契約は `public/url-v1.md`。アプリのヘルプからも参照できます。最終演奏用コードと元入力コードを分け、全選択フォームを明示します。上限はエンコード後URL全体7,168バイト。超過操作は全体を拒否します。

曲全体のコードをカンマ区切りで入力し、登録済みフォームを選択してください。未収録コードや未知のフォームは元名・指定を保持し、図を捏造しません。外部指定は確認前にプレビューし、差分のうち選んだものだけをブラウザ好みに保存します。別曲は「別の曲を入力する」から読み込むと履歴に追加されます。

ライセンス全文は `licenses/THIRD_PARTY_NOTICES.txt` と公開アプリの「データ出典・ライセンス」。
