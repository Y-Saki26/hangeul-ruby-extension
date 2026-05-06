# Hangeul Ruby

Chrome/Firefox 向けの Manifest V3 拡張です。Web ページ上のハングル文字列を検出し、ローマ字のルビを `ruby` / `rt` で追加します。

## 機能

- ページ内の完成形ハングル音節 `가-힣` と字母表記を検出
- DOM のテキストノードだけを置換し、既存のイベントや構造への影響を抑制
- `script`, `style`, `input`, `textarea`, `code`, `pre`, 既存 `ruby` などは除外
- 遅延読み込みされた DOM にも `MutationObserver` で対応
- popup から ON/OFF と「常に表示 / ホバー時のみ」を切り替え

## インストール

1. Chrome で `chrome://extensions/` を開く
2. 「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」を選ぶ
4. このフォルダを選択する

Firefox では `about:debugging#/runtime/this-firefox` から「一時的なアドオンを読み込む」を選び、`manifest.json` を指定してください。

## 現在のローマ字変換

Unicode のハングル音節を初声・中声・終声に分解し、簡易的な Revised Romanization 風の表記へ変換しています。発音変化、連音化、鼻音化、濃音化、辞書ベースの読み分けはまだ扱っていません。

例:

- `한글` -> `hangeul`
- `한글` -> `hangeul`
- `ㅎㅏㄴㄱㅡㄹ` -> `hangeul`
- `한국어` -> `hangukeo`
- `안녕하세요` -> `annyeonghaseyo`

## 今後の改善候補

- 発音変化ルールの追加
- サイト別の有効/無効設定
- 記事本文らしい領域だけを対象にするモード
- ルビサイズや色の設定
- 単語単位の辞書読み補正
