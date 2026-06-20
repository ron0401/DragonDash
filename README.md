# Dragon Dash 🐉

ドラゴンを操作してトンネルを駆け抜ける Babylon.js 製のブラウザゲーム。
サーバー不要の完全な静的サイト（GitHub Pages で公開可能）。

## 構成

```
game/
├── index.html       ゲーム本体 (Babylon.js)
├── lib/             Babylon.js ランタイム
├── bird2.glb        プレイヤー（ドラゴン）モデル
└── models/          敵キャラクターモデル (6体)
```

> 3Dモデルの生成パイプライン（TRELLIS や元写真、.ply / .mp4 などの中間生成物）は
> このリポジトリには含めていません（`.gitignore` で除外）。
> 本リポジトリはゲーム部分のみを管理します。

## 遊び方

`game/index.html` をブラウザで開くだけ。ローカル確認なら任意の静的サーバーでも可:

```bash
cd game
python3 -m http.server 8000   # http://localhost:8000
```

- 移動 : 矢印キー / WASD / マウスドラッグ
- 敵に3回ぶつかるとゲームオーバー。緑の💚で体力回復。
- 最高スコア（自己ベスト）はブラウザのクッキーに保存される。

## GitHub Pages で公開

静的サイトなのでそのまま公開できる。リポジトリの Settings → Pages で
公開元ブランチを指定する。URL は `https://<user>.github.io/<repo>/game/` となる。
（ルート直下を公開URLにしたい場合は `game/` の中身をリポジトリ直下へ移すか、
Pages の公開フォルダを `game/` に設定する。）
