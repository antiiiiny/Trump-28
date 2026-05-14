export interface Bid {
  playerId: string;
  value: number; // 14-28
  passed: boolean;
  isHonours: boolean;
}
