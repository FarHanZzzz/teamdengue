import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { STRINGS, LEVEL_LABEL } from "../i18n/strings";

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("pd_lang") || "en");

  useEffect(() => {
    localStorage.setItem("pd_lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => {
    const dict = STRINGS[lang] || STRINGS.en;
    return {
      lang,
      setLang,
      toggle: () => setLang((l) => (l === "en" ? "bn" : "en")),
      t: (key) => dict[key] ?? key,
      level: (lvl) => (LEVEL_LABEL[lang] || LEVEL_LABEL.en)[lvl] ?? lvl,
      isBn: lang === "bn",
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
