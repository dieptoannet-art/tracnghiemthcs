import { useEffect, useState } from 'react';

const UI_THEME_STORAGE_KEY = 'taydo_premium_ui_2027';
const UI_THEME_EVENT = 'taydo:ui-theme-change';

/**
 * Feature Flag: `premium_ui_2027`
 * Cho phép bật/tắt giao diện Premium Design System 2027 an toàn qua query (?ui=classic | ?ui=2027)
 * hoặc localStorage mà không ảnh hưởng dữ liệu hay logic nghiệp vụ.
 */
export function isPremiumUi2027Enabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const params = new URLSearchParams(window.location.search);
    const qUi = params.get('ui');
    if (qUi === 'classic') return false;
    if (qUi === '2027') return true;

    const stored = window.localStorage.getItem(UI_THEME_STORAGE_KEY);
    if (stored === 'false' || stored === 'classic') return false;
    if (stored === 'true' || stored === '2027') return true;
  } catch {
    // Bỏ qua lỗi đọc storage trong môi trường bị hạn chế
  }
  return true;
}

export function applyUiThemeAttribute(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-ui-theme', enabled ? '2027' : 'classic');
}

export function setPremiumUi2027Enabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(UI_THEME_STORAGE_KEY, enabled ? '2027' : 'classic');
    } catch {
      // ignore storage write failure
    }
    applyUiThemeAttribute(enabled);
    window.dispatchEvent(new CustomEvent(UI_THEME_EVENT, { detail: enabled }));
  }
}

export function usePremiumUi2027(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => isPremiumUi2027Enabled());

  useEffect(() => {
    applyUiThemeAttribute(enabled);
  }, [enabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onThemeChange = (e: Event) => {
      const custom = e as CustomEvent<boolean>;
      if (typeof custom.detail === 'boolean') {
        setEnabled(custom.detail);
      } else {
        setEnabled(isPremiumUi2027Enabled());
      }
    };
    window.addEventListener(UI_THEME_EVENT, onThemeChange);
    return () => window.removeEventListener(UI_THEME_EVENT, onThemeChange);
  }, []);

  const update = (next: boolean) => {
    setEnabled(next);
    setPremiumUi2027Enabled(next);
  };

  return [enabled, update];
}
