export const durations = [90, 180, 300, 1800] as const;
export const modeLabel: Record<number, string> = { 90: "QUICK", 180: "STANDARD", 300: "CHAOS", 1800: "ENDLESS" };
export const defaultNames = [
  "本番環境の破壊神", "金曜夕方のデプロイ王", "ヨシ！の達人", "ログが多すぎる人",
  "ローカルでは動く職人", "無限リトライの妖精", "障害対応会議の覇者", "原因は調査中",
  "暫定対応の永住者", "監視を眠らせし者", "秘伝の手順書の守護者", "本番直編集の勇者",
  "仕様を増やす天才", "未読アラートの覇者", "再起動の伝道師", "深夜の緊急マージ王",
  "承認待ちの亡霊", "手順書なき開拓者", "無言の強制プッシュ", "直せば増えるバグ",
  "レビュー待ちの化石", "依存関係の錬金術師", "例外を握りつぶす者", "テストは心の中",
  "全件検索の探検家", "期限切れ証明書の番人", "環境変数の旅人", "眠らないオンコール",
  "復旧祈願の達人", "再発防止策は気合い", "つながらないDBの主", "見なかったログの王",
  "増え続けるTODO", "キャッシュ消しの匠", "週末を奪う一行", "動くので触らない者",
  "深夜の設定変更王", "あとで直す預言者", "本番だけ違う世界", "空振りロールバック",
  "不具合の育ての親", "謎仕様の語り部", "既読にならない通知", "デグレの申し子",
  "監視閾値の魔術師", "バックアップの幻", "強制終了の達人", "未設定の環境変数",
  "祈りのデータ移行", "終わらぬ依存更新", "ふわっとした要件", "本番で試す哲学者",
  "無限会議の住人", "直したはずの妖怪", "全員管理者の村長", "今日も正常のはず",
  "見積もりは希望", "閉じ忘れたチケット", "権限不足の大魔王", "ログの海の航海士",
] as const;
export const REPLAY_REJECTED = "REPLAY_REJECTED";
export function randomPlayerName(current = ""): string {
  const candidates = defaultNames.filter((name) => name !== current);
  return candidates[Math.floor(Math.random() * candidates.length)];
}
export function validName(value: unknown): value is string {
  return typeof value === "string" && value === value.trim() && Array.from(value).length >= 1 && Array.from(value).length <= 20 && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value);
}
export type ScoreEntry = { player_name: string; score: number; created_at: string };
