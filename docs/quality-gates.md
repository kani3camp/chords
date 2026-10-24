# 品質ゲートと要件の対応

|要件群|実装|検証|
|---|---|---|
|R-01、AC-01/10/22/38/45|domain/chords、state/song|domain.test、controller.test、E2E|
|R-02/03、AC-02/04/14/16/18/25/30/39|catalog、ChordDiagram、候補ダイアログ|全件カタログ検証、独立MIDI期待値、必須フォーム、E2E|
|R-04、AC-05/09/13/29/31/35/41/44/53/57|state/url、app/controller|url.test、controller.test、measure:url、E2E|
|R-06、AC-03/17/21/32/33/47/48/51/56/63|移調計算、sourceShift、カポUI|固定G01〜G06、URL往復、E2E|
|Q-13/30/37/38/44/49/55、AC-23/40/42/50/55/61|外部プレビュー、選択差分、fallback|状態テスト、別コンテキストE2E|
|Q-31/39、AC-43|好み一覧・削除・全削除|controller.test、E2E|
|Q-46/52/56、AC-52/58/62|共通音高ID、別カード、競合確認|domain/controller/E2E|
|Q-48/54/58、AC-54/59/60/64|legacy/invalid registry、照合済み描画|互換性指紋、matcher状態、未登録図非表示|
|Q-59、AC-65|全候補検証、144必須コード、2実練習曲|test:catalog、catalog.test、E2E|
|ADR-060、AC-66のローカル準備|Wrangler Static Assets、CI、公開ヘッダー|build、dry-run、ローカルWorkersの44 E2E|

CIはtypecheck → lint → unit → catalog → baseline diff → URL compatibility → measure → build → E2E。失敗を通過扱いにしません。GitHub ActionsとWorkers Buildsのリモート設定・本番公開はこのローカル作業の範囲外です。

`legacy` と `invalid` は将来の公開データ更新に備えた仕組みです。初回実装時に架空の「過去に公開された誤データ」を本番カタログへ捏造していません。状態検証はテスト専用のフィクスチャを使います。
