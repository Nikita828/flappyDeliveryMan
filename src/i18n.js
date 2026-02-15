// src/i18n.js

// src/i18n.js
export const translations = {
  ru: {
    loading: "Загрузка",
    tapToStart: "Нажмите чтобы начать",
    tapToRestart: "Нажмите чтобы начать заново",
    gameOver: "Игра окончена",
    best: "Лучший",
    yourScore: "Ваш счёт",
    bestScore: "Лучший счёт",
    newRecord: "🎉 Новый рекорд!",
    playAgain: "▶ Ещё раз",          // ✅ НОВЫЙ КЛЮЧ
  },
  en: {
    loading: "Loading",
    tapToStart: "Tap to start",
    tapToRestart: "Tap to restart",
    gameOver: "Game Over",
    best: "Best",
    yourScore: "Your score",
    bestScore: "Best score",
    newRecord: "🎉 New record!",
    playAgain: "▶ Play Again",        // ✅ НОВЫЙ КЛЮЧ
  },
  tr: {
    loading: "Yükleniyor",
    tapToStart: "Başlamak için dokun",
    tapToRestart: "Yeniden başlamak için dokun",
    gameOver: "Oyun Bitti",
    best: "En iyi",
    yourScore: "Skorunuz",
    bestScore: "En iyi skor",
    newRecord: "🎉 Yeni rekor!",
    playAgain: "▶ Tekrar Oyna",       // ✅ НОВЫЙ КЛЮЧ
  },
};

let currentLanguage = 'ru';

/**
 * Получить перевод по ключу
 */
export function t(key) {
  return translations[currentLanguage]?.[key] || key;
}

/**
 * Установить язык
 */
export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    try {
      localStorage.setItem('game-language', lang);
      console.log("✅ Язык сохранён:", lang);
    } catch (e) {
      console.warn('⚠️ Не удалось сохранить язык:', e);
    }
  } else {
    console.warn('⚠️ Неизвестный язык:', lang);
  }
}

/**
 * Получить текущий язык
 */
export function getLanguage() {
  return currentLanguage;
}

/**
 * Загрузить язык с приоритетом SDK
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
    console.warn('⚠️ Не удалось загрузить сохранённый язык:', e);
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
  currentLanguage = 'ru';
  return 'ru';
}

/**
 * Получить список доступных языков
 */
export function getAvailableLanguages() {
  return Object.keys(translations);
}

/**
 * Проверить, существует ли перевод
 */
export function hasTranslation(key) {
  return currentLanguage in translations && key in translations[currentLanguage];
}