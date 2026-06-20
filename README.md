# Dragon Dash 🐉

ドラゴンを操作してトンネルを駆け抜ける Babylon.js 製のブラウザゲーム。
サーバー不要の完全な静的サイト。

## 🎮 プレイ（GitHub Pages）

**▶ https://ron0401.github.io/DragonDash/game/**

スマホ・タブレット・PC のブラウザでそのまま遊べます。

### 📲 アプリとしてインストール（PWA）

ホーム画面に追加すると、アドレスバーなしの全画面アプリとして起動でき、
一度読み込めばオフラインでも遊べます。

- **Android (Chrome)** : スタート画面の「📲 アプリとしてインストール」ボタン、
  またはブラウザメニュー →「アプリをインストール / ホーム画面に追加」
- **iPhone / iPad (Safari)** : 共有ボタン → 「ホーム画面に追加」
- **PC (Chrome / Edge)** : アドレスバー右の ⊕ インストールアイコン

## 構成

```
game/
├── index.html             ゲーム本体 (Babylon.js)
├── manifest.webmanifest   PWA マニフェスト（インストール情報）
├── sw.js                  Service Worker（オフライン対応）
├── icons/                 アプリアイコン (192/512, maskable, apple-touch)
├── lib/                   Babylon.js ランタイム
├── bird2.glb              プレイヤー（ドラゴン）モデル
├── models/                敵キャラクターモデル (6体)
└── assets/                ステージ用フリー素材 (PBRテクスチャ / スカイボックス)
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
- 距離に応じてステージが変化（実写ベースのフリー素材で表現）:
  - 0–2000m : 🌋 1st マグマだまり（溶岩PBRテクスチャ＋発光する割れ目、燃える空）
  - 2000–4000m : 🌿 2nd 岩の草原（草＋岩のPBR地面、青空HDRI）
  - 4000m– : 🌌 3rd 宇宙空間（天の川全天パノラマ、地面なしで星空を飛ぶ）
- 各ステージは PBR 地面マテリアル＋HDRI/パノラマのスカイボックス（IBL）で
  ライティングし、フォグ・ライト色をなめらかに切り替える。

## 素材クレジット（フリー素材）

ステージの見た目は以下の無料素材を利用しています:

- **溶岩テクスチャ**: [ambientCG](https://ambientcg.com) "Lava004" — CC0
- **草＋岩テクスチャ**: [Poly Haven](https://polyhaven.com) "aerial_grass_rock" — CC0
- **燃える空 / 青空 HDRI**: Poly Haven "the_sky_is_on_fire" / "kloofendal_48d_partly_cloudy_puresky" — CC0
- **天の川 全天パノラマ**: ESO/S. Brunier ([eso0932a](https://www.eso.org/public/images/eso0932a/)) — CC BY 4.0

## GitHub Pages で公開

`main` ブランチのルート (`/`) を公開元に設定済み。`game/` 配下にゲームがあるため
公開URLは **https://ron0401.github.io/DragonDash/game/** となる。
`main` に push すると自動で再ビルド・反映される。
