/**
 * Расширенный мок Яндекс SDK для локальной разработки
 */

window.YaGamesMock = {
  config: {
    adDelay: 2000,
    adShowProbability: 1.0,
    networkDelay: 500,
    failProbability: 0,
  },
  
  stats: {
    adsShown: 0,
    scoresSent: 0,
    errors: 0,
  },
  
  resetStats() {
    this.stats = { adsShown: 0, scoresSent: 0, errors: 0 };
    console.log("📊 Статистика сброшена");
  },
  
  showStats() {
    console.table(this.stats);
  }
};

window.YaGames = {
  init: async function() {
    console.log("🎮 [MOCK] Яндекс SDK инициализирован");
    console.log("💡 Команды: YaGamesMock.showStats(), YaGamesMock.config");
    
    const mock = window.YaGamesMock;
    
    return {
      adv: {
        showFullscreenAdv: function(options) {
          console.log("📺 [MOCK] Запрос на показ рекламы");
          
          if (Math.random() > mock.config.adShowProbability) {
            console.warn("⚠️ [MOCK] Реклама не показана");
            if (options.callbacks?.onError) {
              options.callbacks.onError("AD_NOT_AVAILABLE");
            }
            return;
          }
          
          if (Math.random() < mock.config.failProbability) {
            console.error("❌ [MOCK] Ошибка показа рекламы");
            mock.stats.errors++;
            if (options.callbacks?.onError) {
              setTimeout(() => {
                options.callbacks.onError("NETWORK_ERROR");
              }, 100);
            }
            return;
          }
          
          if (options.callbacks?.onOpen) {
            setTimeout(() => {
              console.log("📺 [MOCK] Реклама открыта");
              options.callbacks.onOpen();
            }, 100);
          }
          
          setTimeout(() => {
            console.log("📺 [MOCK] Реклама закрыта");
            mock.stats.adsShown++;
            if (options.callbacks?.onClose) {
              options.callbacks.onClose(true);
            }
          }, mock.config.adDelay);
        }
      },
      
      getLeaderboards: async function() {
        console.log("🏆 [MOCK] Получаем лидерборд");
        
        const mock = window.YaGamesMock;
        
        return {
          setLeaderboardScore: async function(leaderboardName, score) {
            console.log(`🏆 [MOCK] Отправка результата: ${score}`);
            
            await new Promise(resolve => 
              setTimeout(resolve, mock.config.networkDelay)
            );
            
            if (Math.random() < mock.config.failProbability) {
              console.error("❌ [MOCK] Ошибка отправки результата");
              mock.stats.errors++;
              throw new Error("NETWORK_ERROR");
            }
            
            console.log(`✅ [MOCK] Результат ${score} отправлен`);
            mock.stats.scoresSent++;
            return { success: true };
          }
        };
      },
      
      getPlayer: async function() {
        return {
          getID: () => "mock-player-123",
          getName: () => "Тестовый Игрок",
          getPhoto: (size) => `https://via.placeholder.com/${size}`,
        };
      }
    };
  }
};

console.log("✅ Мок Яндекс SDK загружен");