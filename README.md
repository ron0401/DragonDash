# Dragon Dash 🐉

ドラゴンを操作してトンネルを駆け抜ける Babylon.js 製のブラウザゲーム。
共有のグローバルリーダーボード付き。

## 構成

```
game/
├── server.py        静的配信 + リーダーボードAPI (Python標準ライブラリのみ)
├── index.html       ゲーム本体 (Babylon.js)
├── lib/             Babylon.js ランタイム
├── bird2.glb        プレイヤー（ドラゴン）モデル
└── models/          敵キャラクターモデル (6体)
```

> 3Dモデルの生成パイプライン（TRELLIS や元写真、.ply / .mp4 などの中間生成物）は
> このリポジトリには含めていません（`.gitignore` で除外）。
> 本リポジトリはゲーム部分のみを管理します。

## 起動

```bash
cd game
python3 server.py
```

ブラウザで http://localhost:4001 を開く（ポートは `server.py` の `PORT` で変更可）。

## リーダーボード

- `GET  /api/scores` … 上位スコア取得
- `POST /api/scores` … スコア登録 `{ "name": "...", "distance": 123 }`

スコアは `game/scores.json` に保存される（実行時データのためバージョン管理対象外）。
