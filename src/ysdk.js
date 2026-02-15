// src/ysdk.js

let ysdk = null;
let isLocalDev = false;
let gameReadyCalled = false;  // ✅ Защита от повторного вызова

/**
 * Инициализация Яндекс SDK
 * НЕ вызываем gameReady здесь — только после загрузки ресурсов!
 */
export async function initYSDK() {
  if (typeof YaGames === "undefined") {
    console.warn("⚠️ YaGames недоступен (локальная разработка)");
    isLocalDev = true;
    return null;
  }

  try {
    ysdk = await YaGames.init();
    console.log("✅ Яндекс SDK инициализирован");
    
    isLocalDev = window.self === window.top;
    
    if (isLocalDev) {
      console.warn("⚠️ Игра запущена локально, SDK работает в режиме эмуляции");
    }
    
    // ❌ НЕ вызываем gameReady здесь!
    // Он будет вызван из BootScene.create() после загрузки ресурсов
    
    return ysdk;
  } catch (error) {
    console.error("❌ Ошибка инициализации SDK:", error);
    isLocalDev = true;
    return null;
  }
}

/**
 * ✅ Game Ready API — вызывать ПОСЛЕ загрузки всех ресурсов
 */
export function gameReady() {
  if (gameReadyCalled) {
    console.log("ℹ️ gameReady() уже был вызван");
    return;
  }
  
  gameReadyCalled = true;
  
  if (!ysdk || isLocalDev) {
    console.log("🎮 [DEV] Game Ready (эмуляция)");
    return;
  }

  try {
    if (ysdk.features?.LoadingAPI?.ready) {
      ysdk.features.LoadingAPI.ready();
      console.log("✅ Game Ready API: LoadingAPI.ready() вызван");
    } else {
      console.warn("⚠️ LoadingAPI.ready() недоступен");
    }
  } catch (error) {
    console.warn("⚠️ Ошибка вызова gameReady:", error);
  }
}

/**
 * Получить язык из SDK
 */
export function getSDKLanguage() {
  if (!ysdk || isLocalDev) {
    return null;
  }

  try {
    const lang = ysdk.environment?.i18n?.lang || null;
    console.log("🌍 Язык из SDK:", lang);
    return lang;
  } catch (error) {
    console.warn("⚠️ Не удалось получить язык из SDK:", error);
    return null;
  }
}

/**
 * Показ полноэкранной рекламы
 */
export function showFullscreenAd(onOpen, onClose, onError) {
  if (!ysdk || isLocalDev) {
    console.log("🎬 [DEV] Эмуляция полноэкранной рекламы");
    
    if (onOpen) onOpen();
    
    setTimeout(() => {
      if (onClose) onClose(false);
    }, 1000);
    
    return;
  }

  ysdk.adv.showFullscreenAdv({
    callbacks: {
      onOpen: () => {
        console.log("📺 Реклама открыта");
        if (onOpen) onOpen();
      },
      onClose: (wasShown) => {
        console.log("📺 Реклама закрыта, показана:", wasShown);
        if (onClose) onClose(wasShown);
      },
      onError: (error) => {
        console.warn("⚠️ Ошибка показа рекламы:", error);
        if (onError) onError(error);
      },
    },
  });
}

/**
 * Показать sticky баннер
 */
export function showBanner() {
  if (!ysdk || isLocalDev) {
    console.log("📱 [DEV] Эмуляция показа баннера");
    return Promise.resolve({ stickyAdvIsShowing: false });
  }

  return ysdk.adv.showBannerAdv()
    .then((result) => {
      if (result.stickyAdvIsShowing) {
        console.log("📱 Баннер показан");
      } else {
        console.warn("⚠️ Баннер не показан:", result.reason);
      }
      return result;
    })
    .catch((error) => {
      if (!error.message?.includes("No parent")) {
        console.warn("⚠️ Ошибка показа баннера:", error);
      }
      return { stickyAdvIsShowing: false };
    });
}

/**
 * Скрыть sticky баннер
 */
export function hideBanner() {
  if (!ysdk || isLocalDev) {
    console.log("📱 [DEV] Эмуляция скрытия баннера");
    return Promise.resolve({ stickyAdvIsShowing: false });
  }

  return ysdk.adv.hideBannerAdv()
    .then((result) => {
      console.log("📱 Баннер скрыт");
      return result;
    })
    .catch((error) => {
      if (!error.message?.includes("No parent")) {
        console.warn("⚠️ Ошибка скрытия баннера:", error);
      }
      return { stickyAdvIsShowing: false };
    });
}

/**
 * Проверить статус баннера
 */
export function getBannerStatus() {
  if (!ysdk || isLocalDev) {
    return Promise.resolve({ stickyAdvIsShowing: false });
  }

  return ysdk.adv.getBannerAdvStatus()
    .then((result) => {
      console.log("📱 Статус баннера:", result);
      return result;
    })
    .catch((error) => {
      if (!error.message?.includes("No parent")) {
        console.warn("⚠️ Ошибка получения статуса баннера:", error);
      }
      return { stickyAdvIsShowing: false };
    });
}

/**
 * Отправка результата в лидерборд
 */
export function submitScore(score) {
  if (!ysdk || isLocalDev) {
    console.log("🏆 [DEV] Эмуляция отправки результата:", score);
    return;
  }

  if (!ysdk.getLeaderboards) {
    console.warn("⚠️ Лидерборды недоступны");
    return;
  }

  ysdk
    .getLeaderboards()
    .then((lb) => {
      return lb.setLeaderboardScore("main", score);
    })
    .then(() => {
      console.log("🏆 Результат отправлен:", score);
    })
    .catch((error) => {
      console.warn("⚠️ Ошибка отправки результата:", error);
    });
}

/**
 * Проверка, запущена ли игра локально
 */
export function isLocalDevelopment() {
  return isLocalDev;
}