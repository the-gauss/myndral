import type { SubscriptionPlan } from '@/src/types/domain';

export function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatListeners(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }

  return String(value);
}

export function formatReleaseYear(value: string) {
  return new Date(value).getFullYear();
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function sanitizeFileName(value: string) {
  const trimmed = value
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return trimmed || 'export';
}

export function humanizePlan(plan: SubscriptionPlan) {
  if (plan === 'premium_monthly') return 'Premium Monthly';
  if (plan === 'premium_annual') return 'Premium Annual';
  return 'Free';
}

export function isPremiumPlan(plan: SubscriptionPlan | undefined) {
  return plan === 'premium_monthly' || plan === 'premium_annual';
}
