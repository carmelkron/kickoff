import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Language } from '../types';
import { translations, Translations } from '../i18n/translations';
import { useAppPreferences } from './AppPreferencesContext';

interface LanguageContextType {
  lang: Language;
  t: Translations;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { language, setLanguage } = useAppPreferences();
  const lang = language;
  const isRTL = lang === 'he';
  const t = translations[lang];

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, isRTL]);

  const toggleLanguage = () => setLanguage(lang === 'he' ? 'en' : 'he');

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLanguage, setLanguage, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
