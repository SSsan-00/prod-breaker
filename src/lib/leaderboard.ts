export const durations = [90, 180, 300, 1800] as const;
export const modeLabel: Record<number, string> = { 90: "QUICK", 180: "STANDARD", 300: "CHAOS", 1800: "ENDLESS" };
export const defaultNames = ["本番環境の破壊神", "金曜夕方のデプロイ王", "ヨシ！の達人", "ログが多すぎる人", "ローカルでは動く職人", "無限リトライの妖精", "障害対応会議の覇者", "原因は調査中", "暫定対応の永住者", "監視を眠らせし者", "秘伝の手順書の守護者", "本番直編集の勇者"] as const;
export function validName(value: unknown): value is string {
  return typeof value === "string" && value === value.trim() && Array.from(value).length >= 1 && Array.from(value).length <= 20 && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value);
}
export type ScoreEntry = { player_name: string; score: number; created_at: string };
