# PROD KEEPER

**今日も、何も起こさせない。**

[▶ プレイする — prod-keeper.vercel.app](https://prod-keeper.vercel.app/)

[PROD BREAKER](https://prod-breaker.vercel.app/) の姉妹作。セキュリティ担当の小型ロボット SENTINEL として、架空の本番ネットワークを守る防衛サバイバーです。実際のネットワークやサーバーを操作する機能はありません。

## 遊び方

- ドラッグ / WASD / 矢印キーで移動。攻撃は自動です。
- AUTH / WAF / DB / SOC の近くに約3秒留まると施設が復旧し、自動迎撃に加わります。
- 敵から落ちる緑の脅威ログでレベルアップ。3つの候補から強化を選択します。選択中は進行が止まります。
- 対応する2スキルを取得すると進化。16スキルと8つの進化を実装しています。
- 「緊急遮断」 / Space は周囲を迎撃し、ログを全回収。撃破で再使用までの時間を短縮します。
- 連続撃破で8秒の ZERO TRUST MODE。プレイヤーと施設が一斉迎撃します。
- COREかプレイヤーのHPが0になると終了。90秒・3分・5分のシフトを選択できます。
- 終了したプレイは、名前とスコアをNeonの共有スコアボードへ自動登録します。SCOREからモード別TOP 30を確認できます。
- プレイヤー名は任意入力。守る側らしいランダム名・再抽選も用意。SCOREとリザルトから変更でき、リザルトで保存した名前は今回の記録にも反映されます。
- 設定・名前・自己ベストはlocalStorageにも保存。接続できないときは直近20件を再送待ちにし、再接続・次回訪問時に再試行します。

敵は総当たり・フィッシング・インジェクション・ランサムウェア・DDoS・ゼロデイの6種。30秒ごとのWAVEで増援とボスが到着します。

## 開発

Node.js 24 / npm

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
node --experimental-strip-types scripts/balance.mjs
```

Next.js App Router / React / TypeScript strict / Tailwind CSS / Canvas 2D / Web Audio / Vitest / Playwright。
純粋な固定30Hz判定と描画を分離。シード付き乱数、上限付き連鎖、タブ非表示時の一時停止、ミュート・音量・演出軽減に対応。

E2EはPCとスマホで施設救援から90秒のクリア・再挑戦、タッチ操作、画面内レイアウトを検証します。`BASE_URL` を指定すると公開環境で同じテストを実行できます。

## 公開

ソースは [SSsan-00/prod-breaker の prod-keeper ブランチ](https://github.com/SSsan-00/prod-breaker/tree/prod-keeper) にあります。既存作のmainとは独立したアプリです。GitHubの新規リポジトリ作成権限がないため、専用ブランチに保存しています。

Vercelは独立プロジェクト `prod-keeper`（チーム `ss-mrs-projects`）です。Gitの自動連携は設定していません。更新時は専用ブランチの検証済みコミットを指定し、Vercel API / MCP の `create_deployment` で `target: production`、`gitSource.ref: <検証済みコミットSHA>` としてデプロイします。既存作のmainをデプロイしないでください。

Neonの `DATABASE_URL` をVercelのProduction環境変数に設定します。接続情報はサーバー側だけで使用し、Gitにコミットしません。新規の有料リソースは追加していません。

MIT License.

## 初回公開の検証（2026-11-09）

- lint / TypeScript strict / production build 成功。
- 単体テスト12件成功。PC・スマホの通しプレイ、タッチ移動、画面内レイアウト、設定保存、ストレージ使用不可、BGM継続・ミュートをブラウザで検証。
- QUICKをブラウザの自動操作で実時間計測：91.8秒（ゲーム内90秒、強化選択を含む）。207体迎撃、ブラウザ例外0件。人による選択時間で総プレイ時間は変わります。
- 90秒・3分・5分を5シードずつシミュレーション。
- 150体・1,200フレームの判定負荷：平均0.30ms、99パーセンタイル0.88ms（クラウドのNode.js、描画を含まず）。スマホ実機のFPSを保証する値ではありません。

ENDLESSとPWAのオフラインキャッシュは未実装です。


## 共有スコアボードの設定と検証

既存Neonデータベース内に独立した `keeper_scores` テーブルを使用します。BREAK​​ERの `leaderboard_scores` は読み書きしません。初期構築は次の加算型マイグレーションで行います。

```sh
# .env.localにDATABASE_URLを設定済みの場合（接続文字列をログに出さない）
node --env-file=.env.local scripts/migrate.mjs
```

SQLは `db/leaderboard.sql`。APIは `/api/leaderboard`。GETでモード別順位、POSTで終了済みプレイを登録します。同じrun IDは同一モード・同一スコアの名前更新のみを許可し、再送で記録が増殖しません。

スコアはクライアント値だけで受理せず、固定シード・30Hzの移動/PANIC入力・強化選択からサーバー側で全プレイを再計算して一致を検証します。入力の上限、未完了プレイ、余分な操作、無効な強化、スコア改変を拒否します。ゲームロジック変更時はリプレイのバージョン管理も必要です。本人認証や自動操作の検出を行う仕組みではありません。

名前は1〜20文字、制御文字不可。SQLはパラメーター化し、入力名はReactのテキストとして描画します。エラー応答に接続情報を含めません。ローカルテストはAPIをモックし、本番ランキングにテストスコアを残さない構成です。

キャラクターの金属反射・装甲・発光は最初にCanvasへ描画して再利用。ホームとメニューの質感を調整し、モード間でランキングの高さを固定しました。
