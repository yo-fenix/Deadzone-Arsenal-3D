import { PlatformType } from '../types/game';

export function detectPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const width = window.innerWidth;

  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (hasTouch && width >= 680 && width <= 1180)) {
    return 'tablet';
  }
  if (/Mobi|Android|iPhone|iPod/i.test(ua) || (hasTouch && width < 680)) {
    return 'mobile';
  }
  return 'desktop';
}

export function platformLabel(platform: PlatformType): string {
  switch (platform) {
    case 'mobile':
      return 'Móvil';
    case 'tablet':
      return 'Tablet';
    default:
      return 'PC';
  }
}
