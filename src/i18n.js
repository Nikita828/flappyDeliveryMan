// src/i18n.js

export const translations = {
  ru: {
    selectLanguage: "Выберите язык",
    tapToStart: "Нажми чтобы начать",
    score: "Счёт",
    best: "Рекорд",
    gameOver: "КОНЕЦ ИГРЫ",
    yourScore: "Счёт",
    bestScore: "Рекорд",
    newRecord: "⭐ НОВЫЙ РЕКОРД! ⭐",
    tapToRestart: "Нажми для перезапуска",
    loading: "Загрузка",
  },
  
  en: {
    selectLanguage: "Select Language",
    tapToStart: "Tap to start",
    score: "Score",
    best: "Best",
    gameOver: "GAME OVER",
    yourScore: "Score",
    bestScore: "Best",
    newRecord: "⭐ NEW RECORD! ⭐",
    tapToRestart: "Tap to restart",
    loading: "Loading",
  },
  
  tr: {
    selectLanguage: "Dil Seçin",
    tapToStart: "Başlamak için dokun",
    score: "Puan",
    best: "En İyi",
    gameOver: "OYUN BİTTİ",
    yourScore: "Puan",
    bestScore: "En İyi",
    newRecord: "⭐ YENİ REKOR! ⭐",
    tapToRestart: "Yeniden başlamak için dokun",
    loading: "Yükleniyor",
  }
};

let currentLanguage = 'ru';

export function t(key) {
  return translations[currentLanguage][key] || key;
}

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    try {
      localStorage.setItem('game-language', lang);
    } catch (e) {
      console.warn('Не удалось сохранить язык');
    }
  }
}

export function getLanguage() {
  return currentLanguage;
}

/**
 * ОБНОВЛЕНО: Загрузить язык с приоритетом SDK
 */
export function loadSavedLanguage(sdkLanguage = null) {
  // 1. ПРИОРИТЕТ: Язык из Яндекс SDK
  if (sdkLanguage && translations[sdkLanguage]) {
    console.log("🌍 Используем язык из SDK:", sdkLanguage);
    currentLanguage = sdkLanguage;
    return sdkLanguage;
  }
  
  // 2. Сохранённый выбор пользователя
  try {
    const saved = localStorage.getItem('game-language');
    if (saved && translations[saved]) {
      console.log("💾 Используем сохранённый язык:", saved);
      currentLanguage = saved;
      return saved;
    }
  } catch (e) {
    console.warn('Не удалось загрузить сохранённый язык');
  }
  
  // 3. Язык браузера
  const browserLang = navigator.language.split('-')[0];
  if (translations[browserLang]) {
    console.log("🌐 Используем язык браузера:", browserLang);
    currentLanguage = browserLang;
    return browserLang;
  }
  
  // 4. По умолчанию русский
  console.log("🇷🇺 Используем русский по умолчанию");
  return 'ru';
}