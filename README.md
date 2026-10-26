# PROD BREAKER

**BUILD THE BUG. BREAK THE PROD.**

架空の本番環境を連鎖爆破する、ITエンジニア向けブラックコメディ・ブラウザゲーム。実際のサーバー、DB、ネットワークを操作する機能はありません。

## 遊び方

1. GAME STARTを押します。
2. BUG（直接攻撃）、CHAIN（伝播強化）、BOOST（BP倍率）のカードから1枚選びます。
3. 選択可能なノードを押し、DEPLOYします。
4. 自動連鎖中、PANIC「緊急マージ」で全生存ノードへの負荷を一度だけ追加できます。
5. 3ラウンド後、スコア・称号・ジョーク障害報告書を表示。画像保存、対応ブラウザで画像共有、1タップ再挑戦ができます。

カードの永続効果を持ち越します。全滅で操作不能にならないよう、ラウンド間に全ノードのHPを最低45まで自動復旧します。各ハンドには全ノードを対象にできる「無限リトライ」を保証します。稼働率はサービス重み付き残存HP（DB=3、API=2、他=1）です。破壊ノード数は最終ラウンド終了時の値です。

音声は初期ミュート。ユーザー操作後にSOUND ONで自作Web AudioのBGM・SEを有効化できます。設定で音量と演出軽減を変更可能。OSのreduced motion設定にも対応します。設定とハイスコアはlocalStorageに保存し、保存不可でも動作します。

## 開発

Node.js 24、npmを使用。

```sh
npm ci
npm run dev
```

http://localhost:3000 を開いてください。

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

## 技術構成

Next.js App Router / React / TypeScript strict / Tailwind CSS / Motion / Canvas 2D / SVG / Web Audio / Vitest / Testing Library / Playwright / ESLint / GitHub Actions。DB・認証・外部有料API不要。ゲーム中のAPI通信はありません。依存関係はpackage-lock.jsonで固定しています。

- `src/game/engine.ts`: カード12枚、7ノード、有向グラフ、シードPRNG、純粋なFIFO連鎖エンジン、得点・稼働率・報告書。
- `src/components/Game.tsx`: タイトル、3ラウンドの進行、操作、イベントログ再生、設定、リザルト。
- `src/effects/`: deltaTimeによるCanvas粒子、非表示タブの描画停止、Web Audio。
- `src/lib/storage.ts`: 保存不可時のフォールバック。
- `tests/`: エンジン・UI単体テストとPC/スマホE2E。

判定はアニメーションと独立し、同じ入力・シード・PANICイベント位置で同じログを生成します。PANICは表示済みイベント数でタイミングを確定し、起点から再計算した決定的ログに差し替えます。画面の二重操作は同期ロックで防止。200イベント、深度12、同じ送信元・対象・障害種別の2回上限、重複ID排除により循環を終了します。スコアは有効ダメージ×10×カード倍率×(1+min(combo,50)×0.08)。

## 公開

GitHub公開先（未作成）: https://github.com/SSsan-00/prod-breaker

GitHub認証は有効ですが、リポジトリ作成APIは`Resource not accessible by integration (createRepository)`で拒否されました。空のPublicリポジトリの作成と接続への権限付与が必要です。既存リポジトリの上書きはしていません。

Vercel本番URL: **未デプロイ**。この環境のVercel CLIが未認証のため、ユーザーの指示でGitHub公開まで実施しています。

無料枠での手動デプロイ手順:

1. Vercelにログインし「Add New Project」からGitHubの`SSsan-00/prod-breaker`をImport。
2. FrameworkをNext.js、Build Commandを`npm run build`に設定（通常は自動認識）。環境変数は不要。
3. Hobby無料枠でDeploy。有料プランへの変更は不要です。
4. 発行された公開URLで3ラウンド、PANIC、リザルト、再挑戦を確認。
5. 本番URLをこのREADMEへ追記。

## 検証と制限

検証記録は[QA.md](QA.md)を参照。GitHub Actionsはlint、型検査、単体テスト、本番ビルド、ChromiumのPC/スマホE2Eを実行します。

- Web Shareはブラウザの対応・HTTPS・ユーザー操作が必要。未対応時は画像ダウンロードへフォールバックします。
- iOS Safariの実機、Firefox、WebKit、長時間の低性能実機検証は未実施。
- PANICは「緊急マージ」1種類。障害種別は共通faultの1種類。
- ピクセル表現はCSS/SVGによるオリジナル描画。外部画像・音声アセットなし。
- 3ラウンド・カード効果・連鎖は実装済みですが、約90秒の体験に向けた継続的なバランス調整余地があります。

## ライセンス

MIT。ユーザーの公開前承認を得て適用しました。詳細は[LICENSE](LICENSE)。

本番環境は壊れる。でもコンボは止まらない。
