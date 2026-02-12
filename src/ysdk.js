// src/ysdk.js - ПОЛНАЯ ВЕРСИЯ

let ysdk = null;

/**
 * Инициализация Яндекс SDK
 */
export async function initYSDK() {
  if (typeof YaGames === "undefined") {
    return null;
  }

  try {
    ysdk = await YaGames.init();
    console.log("✅ Яндекс SDK инициализирован");
    return ysdk;
  } catch (error) {
    console.error("❌ Ошибка инициализации SDK:", error);
    return null;
  }
}

/**
 * Получить язык из SDK
 */
export function getSDKLanguage() {
  if (!ysdk) {
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
  if (!ysdk || !ysdk.adv) {
    if (onError) onError("SDK недоступен");
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
  if (!ysdk || !ysdk.adv) {
    console.warn("⚠️ SDK недоступен для показа баннера");
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
      console.warn("⚠️ Ошибка показа баннера:", error);
      return { stickyAdvIsShowing: false };
    });
}

/**
 * Скрыть sticky баннер
 */
export function hideBanner() {
  if (!ysdk || !ysdk.adv) {
    return Promise.resolve({ stickyAdvIsShowing: false });
  }

  return ysdk.adv.hideBannerAdv()
    .then((result) => {
      console.log("📱 Баннер скрыт");
      return result;
    })
    .catch((error) => {
      console.warn("⚠️ Ошибка скрытия баннера:", error);
      return { stickyAdvIsShowing: false };
    });
}

/**
 * Проверить статус баннера
 */
export function getBannerStatus() {
  if (!ysdk || !ysdk.adv) {
    return Promise.resolve({ stickyAdvIsShowing: false });
  }

  return ysdk.adv.getBannerAdvStatus()
    .then((result) => {
      console.log("📱 Статус баннера:", result);
      return result;
    })
    .catch((error) => {
      console.warn("⚠️ Ошибка получения статуса баннера:", error);
      return { stickyAdvIsShowing: false };
    });
}

/**
 * Отправка результата в лидерборд
 */
export function submitScore(score) {
  if (!ysdk || !ysdk.getLeaderboards) {
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