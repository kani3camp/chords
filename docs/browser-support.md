# ブラウザ対象と確認範囲

対応対象はPC Chrome/Edge/macOS Safari、iPad Safari。レイアウトはPC 1024px以上、タブレット768〜1023px、検証幅は1440pxと834pxです。スマートフォンはアクセス拒否しませんが専用の動作保証対象にはしていません。

開発時にWindows上のChromium（Playwright 1.64.1同梱）、インストール済みEdge、Playwright WebKit（834px、タッチ有効）で入力、選択、永続好み、共有、復元、移調、カポ、履歴、未対応警告、キーボード操作を確認します。テストは独立コンテキストを使い、実ユーザーのブラウザ好みは変更しません。

機能上必要な基盤はES2022、SVG、native dialog、History API、localStorageです。クリップボード不可時は選択・コピー用テキスト欄へフォールバック。localStorage不可・破損時は通知し、URLを使う機能を維持します。Cookie・ログイン・外部解析通信は不要です。

macOS SafariとiPad Safari実機はこのWindows環境から検証できていません。WebKitの自動テストをSafari実機確認済みと呼びません。最低Safari版の保証は実機確認後に確定し、初回公開前に実機で入力、候補モーダル、コピーの代替経路、好み保存、別端末URL復元を確認してください。
