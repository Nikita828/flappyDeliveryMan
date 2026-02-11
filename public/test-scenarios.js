/**
 * Готовые сценарии для тестирования
 */

window.testSDK = {
  normal() {
    YaGamesMock.config.adDelay = 2000;
    YaGamesMock.config.adShowProbability = 1.0;
    YaGamesMock.config.failProbability = 0;
    YaGamesMock.config.networkDelay = 500;
    console.log("✅ Режим: Нормальная работа");
  },
  
  slowNetwork() {
    YaGamesMock.config.networkDelay = 3000;
    YaGamesMock.config.adDelay = 5000;
    console.log("🐌 Режим: Медленный интернет");
  },
  
  unreliableAds() {
    YaGamesMock.config.adShowProbability = 0.5;
    console.log("🎲 Режим: Реклама показывается в 50% случаев");
  },
  
  errorProne() {
    YaGamesMock.config.failProbability = 0.3;
    console.log("⚠️ Режим: 30% запросов падают с ошибкой");
  },
  
  fast() {
    YaGamesMock.config.adDelay = 500;
    YaGamesMock.config.networkDelay = 100;
    console.log("⚡ Режим: Быстрое тестирование");
  }
};

console.log("🧪 Тестовые сценарии загружены");
console.log("Команды: testSDK.normal(), testSDK.fast(), testSDK.errorProne()");