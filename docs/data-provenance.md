# フォームデータの出典と品質

- 上流: [tombatossals/chords-db](https://github.com/tombatossals/chords-db)
- 固定コミット: `df06fa7b425cf5fd29485ff6591236b3557e3fac` / package version 0.6.0
- ライセンス: MIT / Copyright (c) 2016 David Rubert。全文は `licenses/chords-db-MIT.txt` と公開 `third-party-notices.txt`。
- 生成物: `src/catalog/generated/guitar.json`。上流ソースを実行せず `lib/guitar.json` を変換。

`lib/guitar.json` は6弦→1弦、正値のfretsはbaseFret相対です。`src/tools.js` のprocessFrets/processPosition/chord2midiおよびC/D/Dsus2/Gの固定期待値で確認しました。READMEの古い逆順例をそのまま流用しません。`capo:true` は上流のセーハ情報であり、利用者のカポ設定へ転記しません。

正のフレットに `baseFret - 1` を加え、開放0・ミュート−1を維持。代表指番号を保持し、同じ指が同一フレットの複数弦に当たる箇所を開始・終了弦付きのセーハに正規化します。上流MIDI配列と全音を照合します。

3,283候補を調査し、不一致659候補を隔離しました。主な除外理由は特徴音不足、構成音外の音、ベース音違い、指番号の不整合です。除外リストと元指定は `docs/catalog-report.json` に記録。隔離したものを未検証のまま公開候補にしません。

ユーザー指定Claudeデザインのオープンフォームを15件照合して既定に登録。実練習曲で必要な別のコード名にも、既存のライセンス付きフォームがそのコードの必須音・許容音・指定ベース音をすべて満たす場合に限りビルド時に登録しました。ランタイムで自由フォームを合成することはありません。最終件数と未対応率は `docs/coverage.json` を正本にします。

2026-10-25の本人指定画像により、Gm=`355333`、Cm=`335543`、C7sus4=`335363` を初期フォームへ設定しました。指定は `src/catalog/personal-defaults.json` に保持し、再生成時にも検証済みの既存候補を先頭へ移します。指番号・3フレットの全弦セーハは登録済みデータが画像と一致することを確認しています。旧既定Gm=`310033`、Cm=`x31013`、C7sus4=`x33311` は候補として残し、既存URLを同じ図で復元します。互換性baselineでは、この3コードの既定値だけを意図的に更新し、全フォームの指紋を維持します。

省略規則は保守的です。完全5度は任意。4音以上の拡張和音ではルート省略を許可し、種類を特徴づける音は必要とします。三和音のルートと長短3度、susの置換音、7thの7度などを検証。分数コードは6弦の実MIDI音の最小値から指定ベースを照合し、明示された構成音外ベースのみ追加許容します。より寛容な省略音の採用には別途音楽的レビューが必要です。

## 再生成

```sh
git clone https://github.com/tombatossals/chords-db.git .cache/chords-db
git -C .cache/chords-db checkout df06fa7b425cf5fd29485ff6591236b3557e3fac
pnpm catalog:import
pnpm test:catalog
pnpm catalog:diff
```

通常のinstall/buildに上流取得は不要です。監査済み生成物を同梱しています。

過去の候補が上流から消えた場合は生成処理で `legacy` として指番号・押弦・セーハを保持します。音楽的に無効なら `invalid` と理由を記録し、古いURLでも図を出しません。既存URLに登録のない任意フォームを追加する仕組みではありません。`catalog-baseline.json` は初回公開候補の全ダイアグラム指紋と既定位置を固定し、変更をCIで検出します。誤登録の訂正は理由・URL影響をレビューしてからbaselineを明示更新します。

2026-10-26、Bメジャーの既定フォームを6弦ミュートのルート位置 `x24442` に修正しました。代表運指は `012341`（5弦から1弦まで2フレットを人差し指でセーハ）で、構成音と最低音Bを照合済みです。以前の既定 `224442` はB/F#の響きですが、Bの登録済み候補として残し、既存の明示フォーム付きURLは変更なく復元できます。生成スクリプトの監査済み定番フォーム、生成カタログ、互換性baseline、必須フォームテストを同時更新します。
