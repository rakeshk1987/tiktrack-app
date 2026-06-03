import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export type StarPayoutMap = Record<1 | 2 | 3 | 4 | 5, number>;

export interface CashRewardSettings {
  currency_symbol: string;
  point_to_cash_rate: number;
  star_payout_percentages: StarPayoutMap;
}

export const DEFAULT_STAR_PAYOUT_PERCENTAGES: StarPayoutMap = {
  1: 5,
  2: 20,
  3: 50,
  4: 80,
  5: 100,
};

export const DEFAULT_CASH_REWARD_SETTINGS: CashRewardSettings = {
  currency_symbol: '₹',
  point_to_cash_rate: 1,
  star_payout_percentages: DEFAULT_STAR_PAYOUT_PERCENTAGES,
};

export const clampPerformanceStars = (stars: unknown): 1 | 2 | 3 | 4 | 5 => {
  const value = Math.round(Number(stars));
  if (value <= 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  if (value === 4) return 4;
  return 5;
};

export const normalizeRewardSettings = (raw?: Partial<CashRewardSettings> & Record<string, unknown>): CashRewardSettings => {
  const rawMap = raw?.star_payout_percentages as Partial<Record<string, unknown>> | undefined;
  const star_payout_percentages = ([1, 2, 3, 4, 5] as const).reduce((acc, star) => {
    const value = Number(rawMap?.[star] ?? rawMap?.[String(star)] ?? DEFAULT_STAR_PAYOUT_PERCENTAGES[star]);
    acc[star] = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : DEFAULT_STAR_PAYOUT_PERCENTAGES[star];
    return acc;
  }, {} as StarPayoutMap);

  const pointToCashRate = Number(raw?.point_to_cash_rate ?? raw?.star_to_currency_rate ?? 1);

  return {
    currency_symbol: String(raw?.currency_symbol || DEFAULT_CASH_REWARD_SETTINGS.currency_symbol),
    point_to_cash_rate: Number.isFinite(pointToCashRate) ? Math.max(0, pointToCashRate) : DEFAULT_CASH_REWARD_SETTINGS.point_to_cash_rate,
    star_payout_percentages,
  };
};

export const calculateCashReward = (
  basePoints: unknown,
  performanceStars: unknown = 5,
  settings: CashRewardSettings = DEFAULT_CASH_REWARD_SETTINGS
) => {
  const base = Math.max(0, Number(basePoints) || 0);
  const stars = clampPerformanceStars(performanceStars);
  const percentage = settings.star_payout_percentages[stars] ?? DEFAULT_STAR_PAYOUT_PERCENTAGES[stars];
  const amount = Number((base * settings.point_to_cash_rate * (percentage / 100)).toFixed(2));

  return {
    base,
    stars,
    percentage,
    amount,
  };
};

export const formatCash = (amount: unknown, symbol = DEFAULT_CASH_REWARD_SETTINGS.currency_symbol) => {
  const value = Number(amount) || 0;
  return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

export const fetchCashRewardSettings = async (familyId?: string, parentId?: string): Promise<CashRewardSettings> => {
  const ids = Array.from(new Set([familyId, parentId].filter(Boolean))) as string[];
  if (ids.length === 0) return DEFAULT_CASH_REWARD_SETTINGS;

  for (const id of ids) {
    const [familySnap, parentSnap] = await Promise.all([
      getDocs(query(collection(db, 'reward_settings'), where('family_id', '==', id))),
      getDocs(query(collection(db, 'reward_settings'), where('parent_id', '==', id))),
    ]);
    const docSnap = familySnap.docs[0] || parentSnap.docs[0];
    if (docSnap) {
      return normalizeRewardSettings(docSnap.data() as Record<string, unknown>);
    }
  }

  return DEFAULT_CASH_REWARD_SETTINGS;
};
