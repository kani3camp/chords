# 全登録コードの初期フォーム再点検（2026-10-29）

## 対象と方法

- 現行カタログの **693 コード**を走査（692 コードでフォームあり、**1 コードは未収録**）。追加後の候補数は 3367 件。全候補の音程・和音構成・セーハ・代表指番号は `pnpm test:catalog` で検証する。
- 2種類の独立した演奏資料：[DadaGP](https://github.com/adhooge/guitar-chord-diagram-suggestion/tree/98554b52d341bf5afb6b5eb1b584536281dd3894/data/DadaGP)（31321 遷移行）と [mySongBook](https://github.com/adhooge/guitar-chord-diagram-suggestion/tree/98554b52d341bf5afb6b5eb1b584536281dd3894/data/mySongBook)（37540 出現行）。それぞれ異なる楽曲コーパスだが**同じ研究リポジトリ**で提供。データベースライセンス ODbL。データを同梱せず、押弦ごとの出現曲数のみ記録。
- 教則・コード図の別資料：[Strumly guitar chord library](https://strumly.suedeai.ai/chords)、[Fender C#mレッスン](https://www.fender.com/articles/chords/how-to-play-c-sharp-minor-guitar-chord)、[temoto.app C#m](https://temoto.app/chord/guitar/csm/)、[Bmコード図](https://chordwiki.com/guitar/chords/b-minor/)。既存 `tombatossals/chords-db` から派生した別DBは独立した裏付けとして数えない。
- コーパスの数値は同じ曲で当該押弦が観測された**ユニーク曲数**。誤ったコードラベルがあり得るため音楽的適合性は独立して確認。**出現頻度は一般性の補助指標であり正しさの証明ではない**。稀なテンションや分数コードは定番形の情報が不足する。

## 集計

|項目|件数|
|---|---:|
|登録コードの総数|693|
|フォームを持つコード|692|
|フォーム未収録|1|
|初期フォームの変更|35|
|フォーム新規追加|15|
|新既定が両コーパスで一致|105|
|新既定が片方のみ一致|117|
|どちらでも一致しない新既定|470|
|少なくとも1候補が両コーパスで一致|122|
|新既定の最低音がルート/指定ベースと異なる|29|
|明示された個人設定を維持|3|

※最低音の不一致は転回形・ルート省略を含み、即座に「間違い」とは限らない。特に個人が指定した Cm=`335543`・C7sus4=`335363` を勝手に変更しない。

## 代表的な修正

|コード|旧既定|新既定|根拠|
|---|---|---|---|
|C#m / Dbm|`x4212x`|`x46654`|Fender、temoto、Strumlyで共通の5弦ルート形|
|Bm|`224432`|`x24432`|Strumly・Bmコード教材の5弦ルート形|
|Ebm|`xx1342`|`x68876`|Strumlyの定番セーハ|
|Bmaj7|`224342`|`x24342`|Strumlyの5弦ルート形|
|Bsus2|`224422`|`x24422`|Strumlyの5弦ルート形|
|Eb|`xx1343`|`x68886`|両コーパスで高頻度、Strumlyの形とも一致|
|Cm7|`8x888x`|`x35343`|両コーパスで高頻度、Strumlyとも一致|
|E5|`12:14:x:x:x:x`|`022xxx`|両コーパスで圧倒的に多い低フレットフォーム|
|Asus4|`x00230`|`x02230`|両コーパスとStrumlyで一致|

## 解釈と残課題

- **全693コードを2つの独立した資料で個別に裏付けたわけではない。** 両方で一致しなかった 470 件の定番性は未確定。複雑なテンション、分数コードでは次回以降の教則資料・専門家確認が必要。
- `src/catalog/audited-defaults.json` に優先フォームと追加フォームを定義。再インポート時にも同じ候補順に反映する。全件の結果・根拠のコーパス曲数と変更差分は [default-voicing-audit.json](default-voicing-audit.json) を参照。
- 既存の `forms` 指定付き共有URLやブラウザに保存された好みは変更しない。候補を削除せず、旧フォームをアクティブ候補または互換用に残す。Gm=`355333`、Cm=`335543`、C7sus4=`335363` の個別指定は維持する。
