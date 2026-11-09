# PROD KEEPER

**今日も、何も起こさせない。**

[PROD BREAKER](https://prod-breaker.vercel.app/) の姉妹作。セキュリティ担当の小型ロボット SENTINEL として、架空の本番ネットワークを守る防衛サバイバーです。実際のネットワークやサーバーを操作する機能はありません。

## 遊び方

- ドラッグ / WASD / 矢印キーで移動。攻撃は自動です。
- AUTH / WAF / DB / SOC の近くに約3秒留まると施設が復旧し、自動迎撃に加わります。
- 敵から落ちる緑の脅威ログでレベルアップ。3つの候補から強化を選択します。選択中は進行が止まります。
- 対応する2スキルを取得すると進化。16スキルと8つの進化を実装しています。
- 「緊急遮断」 / Space は周囲を迎撃し、ログを全回収。撃破で再使用までの時間を短縮します。
- 連続撃破で8秒の ZERO TRUST MODE。プレイヤーと施設が一斉迎撃します。
- COREかプレイヤーのHPが0になると終了。90秒・3分・5分のシフトを選択できます。
- スコアと設定はこのブラウザのlocalStorageに保存。オンラインランキングはありません。

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

Vercelは独立プロジェクト `prod-keeper`（チーム `ss-mrs-projects`）です。Gitの自動連携は設定していません。更新時は専用ブランチの検証済みコミットを指定し、Vercel API / MCP の `create_deployment` で `target: production`、`gitSource.ref: prod-keeper` としてデプロイします。既存作のmainをデプロイしないでください。

秘密情報やDB接続は不要です。有料機能は追加していません。

MIT License.
