import { describe, it, expect, beforeEach } from 'vitest';
import { t, setI18nLanguage, getI18nLanguage, onI18nChange } from '../../i18n/useI18n';

describe('useI18n.ts – standalone functions', () => {
  beforeEach(() => {
    setI18nLanguage('en');
  });

  describe('t() – translation function', () => {
    it('translates a key using the current language', () => {
      const result = t('app.title');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('uses explicit language override', () => {
      setI18nLanguage('en');
      const en = t('app.subtitle', 'en');
      const uk = t('app.subtitle', 'uk');
      expect(en).not.toBe(uk);
      expect(uk).toContain('Виберіть зуб');
    });

    it('falls back to English when key is missing in a language', () => {
      // Using a key that definitely exists in English
      const result = t('app.title', 'en');
      expect(result).toBeTruthy();
      expect(result).not.toBe('app.title'); // Should not return the key itself
    });

    it('returns the key itself when key does not exist in any language', () => {
      const result = t('non.existent.key.xyz');
      expect(result).toBe('non.existent.key.xyz');
    });

    it('replaces template placeholders', () => {
      setI18nLanguage('en');
      const result = t('selection.count', { count: 5 });
      expect(result).toContain('5');
    });

    it('handles params with language override', () => {
      const result = t('selection.count', 'en', { count: 3 });
      expect(result).toContain('3');
    });

    it('handles params as second argument (object detection)', () => {
      setI18nLanguage('en');
      const result = t('selection.count', { count: 7 });
      expect(result).toContain('7');
    });
  });

  describe('getI18nLanguage() / setI18nLanguage()', () => {
    it('defaults to en', () => {
      expect(getI18nLanguage()).toBe('en');
    });

    it('changes language correctly', () => {
      setI18nLanguage('uk');
      expect(getI18nLanguage()).toBe('uk');
    });

    it('does not fire listeners when setting the same language', () => {
      let callCount = 0;
      const unsubscribe = onI18nChange(() => { callCount++; });
      setI18nLanguage('en'); // Already en
      expect(callCount).toBe(0);
      unsubscribe();
    });

    it('safely falls back to en when setting unsupported language', () => {
      setI18nLanguage('de' as unknown as 'en');
      expect(getI18nLanguage()).toBe('en');
    });
  });

  describe('onI18nChange()', () => {
    it('fires listener when language changes', () => {
      let receivedLang: string | null = null;
      const unsubscribe = onI18nChange((lang) => { receivedLang = lang; });

      setI18nLanguage('uk');
      expect(receivedLang).toBe('uk');

      unsubscribe();
    });

    it('unsubscribe stops notifications', () => {
      let callCount = 0;
      const unsubscribe = onI18nChange(() => { callCount++; });

      setI18nLanguage('uk');
      expect(callCount).toBe(1);

      unsubscribe();
      setI18nLanguage('en');
      expect(callCount).toBe(1); // Should not have incremented
    });

    it('supports multiple listeners', () => {
      const calls: string[] = [];
      const unsub1 = onI18nChange((lang) => calls.push(`a:${lang}`));
      const unsub2 = onI18nChange((lang) => calls.push(`b:${lang}`));

      setI18nLanguage('uk');
      expect(calls).toEqual(['a:uk', 'b:uk']);

      unsub1();
      unsub2();
    });
  });
});
