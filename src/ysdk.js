let ysdk = null;

/**
 * Инициализация Яндекс SDK
 */
export async function initYSDK() {
  // Проверяем доступность YaGames
  if (typeof YaGames === "undefined") {
    // УБИРАЕМ console.warn - работаем тихо
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
 * Показ полноэкранной рекламы
 */
export function showFullscreenAd(onOpen, onClose, onError) {
  if (!ysdk || !ysdk.adv) {
    // Тихо пропускаем если SDK недоступен
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
 * Отправка результата в лидерборд
 */
export function submitScore(score) {
  if (!ysdk || !ysdk.getLeaderboards) {
    // Тихо пропускаем
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