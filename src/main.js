import Phaser from "phaser";
import { 
  initYSDK, 
  getSDKLanguage,
  showFullscreenAd, 
  submitScore, 
  showBanner, 
  hideBanner, 
  getBannerStatus,
  gameReady        // <-- НОВЫЙ ИМПОРТ
} from "./ysdk.js";
import { LanguageScene } from "./LanguageScene.js";
import { t, setLanguage, getLanguage, loadSavedLanguage } from "./i18n.js";

const WIDTH = 360;
const HEIGHT = 640;
const GROUND_H = 80;

// ========================================
// === ОТКЛЮЧЕНИЕ ВЫДЕЛЕНИЯ И МЕНЮ      ===
// ========================================
const style = document.createElement('style');
style.textContent = `
  * {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    user-select: none !important;
    -webkit-tap-highlight-color: transparent !important;
    -webkit-touch-callout: none !important;
  }
  
  canvas, body, html, #app {
    touch-action: none !important;
    -ms-touch-action: none !important;
    overscroll-behavior: none !important;
  }

  img, a, div, span, p, canvas {
    -webkit-user-drag: none !important;
    user-drag: none !important;
  }
`;
document.head.appendChild(style);

// Блокировка всех контекстных меню и выделений
document.addEventListener('contextmenu', e => e.preventDefault(), { passive: false });
document.addEventListener('selectstart', e => e.preventDefault(), { passive: false });
document.addEventListener('dragstart', e => e.preventDefault(), { passive: false });

// Блокировка долгого нажатия на мобильных
document.addEventListener('touchstart', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

document.addEventListener('touchmove', e => {
  e.preventDefault();
}, { passive: false });

// Блокировка двойного тапа для зума
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// Блокировка жестов масштабирования
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', e => e.preventDefault(), { passive: false });

// ========================================
// === СЦЕНА ЗАГРУЗКИ                   ===
// ========================================
class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    const progressBox = this.add.graphics();
    const progressBar = this.add.graphics();
    
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(WIDTH / 2 - 160, HEIGHT / 2 - 25, 320, 50);

    const loadingText = this.add.text(WIDTH / 2, HEIGHT / 2 - 50, t('loading') + "...", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
    }).setOrigin(0.5);

    const percentText = this.add.text(WIDTH / 2, HEIGHT / 2, "0%", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.load.on("progress", (value) => {
      percentText.setText(parseInt(value * 100) + "%");
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(WIDTH / 2 - 150, HEIGHT / 2 - 15, 300 * value, 30);
    });

    this.load.on("loaderror", (file) => {
      console.error("❌ Ошибка загрузки файла:", file.src);
      loadingText.setText("Error!");
      loadingText.setColor("#ff0000");
    });

    this.load.on("complete", () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    this.load.image("bird", "./bird.png");
  }

  create() {
    // ✅ Game Ready API — вызываем ПОСЛЕ загрузки всех ресурсов
    gameReady();
    this.scene.start("game");
  }
}

// ========================================
// === ОСНОВНАЯ ИГРОВАЯ СЦЕНА           ===
// ========================================
class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
  }

  init() {
    this.gapPadding = 22;
    this.state = "idle";
    this.score = 0;
    this.scrollSpeed = 170;
    this.pipeGap = 170;
    this.spawnInterval = 1400;
    this.spawnTimer = null;
    this.lastGapCenter = HEIGHT / 2;
    this.maxGapShift = 120;
    
    // ✅ Флаг для предотвращения мгновенного рестарта после рекламы
    this.adJustClosed = false;

    this.bestScore = this.loadBestScore();

    this.buildingColors = [
      0x8b5e3c, 0xa0522d, 0x6b7b8d, 0x7a6655,
      0x9b7653, 0x5f7a8a, 0x8b7d6b, 0x6a5f50,
    ];

    if (window.lastAdTime === undefined) {
      window.lastAdTime = 0;
    }
  }

  loadBestScore() {
    try {
      const saved = localStorage.getItem("flappy-best");
      return saved ? parseInt(saved, 10) : 0;
    } catch (e) {
      console.warn("⚠️ localStorage недоступен:", e);
      return 0;
    }
  }

  saveBestScore(score) {
    try {
      localStorage.setItem("flappy-best", String(score));
      return true;
    } catch (e) {
      console.warn("⚠️ Не удалось сохранить рекорд:", e);
      return false;
    }
  }

  preload() {
    // Загрузка уже выполнена в BootScene
  }

  create() {
    const langButton = this.add.text(WIDTH - 15, 15, "🌍", {
      fontSize: "24px",
    }).setOrigin(1, 0).setDepth(100);

    langButton.setInteractive({ useHandCursor: true });

    langButton.on('pointerdown', () => {
      const langs = ['ru', 'en', 'tr'];
      const currentIndex = langs.indexOf(getLanguage());
      const nextLang = langs[(currentIndex + 1) % langs.length];
      
      setLanguage(nextLang);
      this.scene.restart();
    });

    if (!this.textures.exists("px")) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 1, 1);
      g.generateTexture("px", 1, 1);
      g.destroy();
    }

    const skyGraphics = this.add.graphics();
    const skySteps = 20;
    const stepH = (HEIGHT - GROUND_H) / skySteps;

    for (let i = 0; i < skySteps; i++) {
      const t = i / skySteps;
      const r = Math.round(100 + t * 75);
      const g = Math.round(170 + t * 55);
      const b = Math.round(230 + t * 25);
      const color = (r << 16) | (g << 8) | b;

      skyGraphics.fillStyle(color, 1);
      skyGraphics.fillRect(0, i * stepH, WIDTH, stepH + 1);
    }
    skyGraphics.setDepth(0);

    this.clouds = [];
    this.createClouds();

    this.groundTop = HEIGHT - GROUND_H;

    this.add
      .image(WIDTH / 2, HEIGHT - GROUND_H / 2, "px")
      .setTint(0x5a4a3a)
      .setDisplaySize(WIDTH, GROUND_H)
      .setDepth(5);

    this.add
      .image(WIDTH / 2, this.groundTop + 4, "px")
      .setTint(0x4caf50)
      .setDisplaySize(WIDTH, 8)
      .setDepth(6);

    this.add
      .image(WIDTH / 2, this.groundTop + 9, "px")
      .setTint(0x388e3c)
      .setDisplaySize(WIDTH, 3)
      .setDepth(6);

    for (let i = 0; i < 15; i++) {
      const dx = Phaser.Math.Between(10, WIDTH - 10);
      const dy = Phaser.Math.Between(this.groundTop + 15, HEIGHT - 10);
      this.add
        .image(dx, dy, "px")
        .setTint(0x4a3a2a)
        .setDisplaySize(
          Phaser.Math.Between(2, 5),
          Phaser.Math.Between(2, 4)
        )
        .setAlpha(0.4)
        .setDepth(6);
    }

    this.player = this.physics.add.image(90, HEIGHT / 3, "bird");
    this.player.setDisplaySize(110, 70);
    this.player.setDepth(10);
    this.player.body.setAllowGravity(false);
    this.player.body.setSize(50, 36);
    this.player.body.setOffset(
      (this.player.width - this.player.body.width) / 2,
      (this.player.height - this.player.body.height) / 2
    );

    this.playerBaseScaleX = this.player.scaleX;
    this.playerBaseScaleY = this.player.scaleY;

    this.idleTween = this.tweens.add({
      targets: this.player,
      y: this.player.y - 15,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.playerShadow = this.add
      .image(90, this.groundTop - 5, "px")
      .setTint(0x000000)
      .setDisplaySize(40, 8)
      .setAlpha(0.15)
      .setDepth(4);

    this.pipeMarkers = [];

    this.scoreText = this.add
      .text(WIDTH / 2, 40, "0", {
        fontFamily: "Arial",
        fontSize: "44px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#2c3e50",
        strokeThickness: 5,
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: "#00000044",
          blur: 4,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.bestText = this.add
      .text(WIDTH / 2, 78, t('best') + ": " + this.bestScore, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffffcc",
        stroke: "#00000066",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.hintText = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 80, t('tapToStart'), {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.tweens.add({
      targets: this.hintText,
      alpha: 0.4,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.gameOverPanel = this.add
      .container(WIDTH / 2, HEIGHT / 2)
      .setDepth(200);
    this.gameOverPanel.setVisible(false);

    const panelGraphics = this.add.graphics();
    panelGraphics.fillStyle(0x1a1a2e, 0.85);
    panelGraphics.fillRoundedRect(-145, -130, 290, 260, 16);
    panelGraphics.lineStyle(2, 0xffffff, 0.2);
    panelGraphics.strokeRoundedRect(-145, -130, 290, 260, 16);

    const goTitle = this.add
      .text(0, -95, t('gameOver'), {
        fontFamily: "Arial",
        fontSize: "30px",
        color: "#ff6b6b",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const divider = this.add.graphics();
    divider.lineStyle(1, 0xffffff, 0.2);
    divider.lineBetween(-100, -68, 100, -68);

    this.panelScoreText = this.add
      .text(0, -45, "", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    this.panelBestText = this.add
      .text(0, -10, "", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#ffd93d",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    this.newRecordText = this.add
      .text(0, 25, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffd93d",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    // ✅ КНОПКА "Играть снова" — реклама показывается по действию пользователя
    const restartBtnBg = this.add.graphics();
    restartBtnBg.fillStyle(0x4caf50, 1);
    restartBtnBg.fillRoundedRect(-80, 55, 160, 50, 12);
    restartBtnBg.lineStyle(2, 0x388e3c, 1);
    restartBtnBg.strokeRoundedRect(-80, 55, 160, 50, 12);

    this.restartBtnText = this.add
      .text(0, 80, t('playAgain'), {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    // Интерактивная зона для кнопки
    const restartHitArea = this.add
      .rectangle(0, 80, 160, 50, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    restartHitArea.on('pointerover', () => {
      restartBtnBg.clear();
      restartBtnBg.fillStyle(0x66bb6a, 1);
      restartBtnBg.fillRoundedRect(-80, 55, 160, 50, 12);
      restartBtnBg.lineStyle(2, 0x388e3c, 1);
      restartBtnBg.strokeRoundedRect(-80, 55, 160, 50, 12);
    });

    restartHitArea.on('pointerout', () => {
      restartBtnBg.clear();
      restartBtnBg.fillStyle(0x4caf50, 1);
      restartBtnBg.fillRoundedRect(-80, 55, 160, 50, 12);
      restartBtnBg.lineStyle(2, 0x388e3c, 1);
      restartBtnBg.strokeRoundedRect(-80, 55, 160, 50, 12);
    });

    restartHitArea.on('pointerdown', () => {
      this.restartWithAd();
    });

    this.gameOverPanel.add([
      panelGraphics,
      goTitle,
      divider,
      this.panelScoreText,
      this.panelBestText,
      this.newRecordText,
      restartBtnBg,
      this.restartBtnText,
      restartHitArea,
    ]);

    this.input.on("pointerdown", this.handleTap, this);
    this.input.addPointer(2);

    // ✅ Пробел работает во ВСЕХ состояниях
    this.input.keyboard.on('keydown-SPACE', () => {
      this.handleSpaceBar();
    });

    this.game.events.on('blur', () => {
      if (this.state === 'play') {
        this.scene.pause();
      }
    });

    this.game.events.on('focus', () => {
      if (this.scene.isPaused()) {
        this.scene.resume();
      }
    });

    this.time.delayedCall(1000, () => {
      showBanner().then((result) => {
        if (result.stickyAdvIsShowing) {
          console.log("✅ Баннер активен");
        } else if (result.reason) {
          console.log("ℹ️ Баннер не показан:", result.reason);
        }
      });
    });

    if (import.meta.env.MODE !== "production") {
      this.setupDebugTools();
    }
  }

  setupDebugTools() {
    window.__scene = this;
    window.bot = { enabled: false };
    window.cheat = {
      godMode: () => {
        this.player.body.setSize(1, 1);
        console.log("🛡️ God mode ON");
      },
      mortal: () => {
        this.player.body.setSize(50, 36);
        console.log("💀 God mode OFF");
      },
      addScore: (n = 10) => {
        for (let i = 0; i < n; i++) this.addScore();
        console.log(`+${n} очков, всего: ${this.score}`);
      },
      setScore: (n) => {
        this.score = n;
        this.scoreText.setText(String(n));
        console.log(`Счёт: ${n}`);
      },
      die: () => {
        this.die();
        console.log("💀 Смерть");
      },
      speed: (v) => {
        this.scrollSpeed = v;
        console.log(`Скорость: ${v}`);
      },
      gap: (v) => {
        this.pipeGap = v;
        console.log(`Щель: ${v}`);
      },
      pause: () => {
        this.scene.pause();
        console.log("⏸️ Пауза");
      },
      resume: () => {
        this.scene.resume();
        console.log("▶️ Продолжить");
      },
      debug: (on = true) => {
        if (on) {
          if (!this.physics.world.debugGraphic) {
            this.physics.world.createDebugGraphic();
          }
          this.physics.world.drawDebug = true;
          this.physics.world.debugGraphic.setVisible(true);
          this.physics.world.debugGraphic.setDepth(999);
        } else {
          this.physics.world.drawDebug = false;
          if (this.physics.world.debugGraphic) {
            this.physics.world.debugGraphic.setVisible(false);
          }
        }
        console.log(`🔍 Debug: ${on}`);
      },
      tp: (x, y) => {
        this.player.setPosition(x, y);
        console.log(`Телепорт: ${x}, ${y}`);
      },
      resetBest: () => {
        this.saveBestScore(0);
        this.bestScore = 0;
        this.bestText.setText(t('best') + ": 0");
        console.log("🗑️ Рекорд сброшен");
      },
      bot: (on = true) => {
        window.bot.enabled = on;
        console.log(on ? "🤖 Бот ON" : "🤖 Бот OFF");
      },
    };
  }

  createClouds() {
    for (let i = 0; i < 5; i++) {
      const cloud = this.add
        .image(
          Phaser.Math.Between(0, WIDTH),
          Phaser.Math.Between(30, HEIGHT / 2 - 50),
          "px"
        )
        .setTint(0xffffff)
        .setDisplaySize(
          Phaser.Math.Between(50, 100),
          Phaser.Math.Between(15, 30)
        )
        .setAlpha(Phaser.Math.FloatBetween(0.2, 0.5))
        .setDepth(1);

      cloud.cloudSpeed = Phaser.Math.FloatBetween(8, 20);
      this.clouds.push(cloud);
    }
  }

  // ✅ Обработка пробела — работает во всех состояниях
  handleSpaceBar() {
    if (this.state === "idle") {
      this.startGame();
    } else if (this.state === "play") {
      this.handleJump();
    } else if (this.state === "gameover") {
      this.restartWithAd();
    }
  }

  handleJump() {
    if (this.state === "idle") {
      this.startGame();
    } else if (this.state === "play") {
      this.player.body.setVelocityY(-330);

      const bx = this.playerBaseScaleX;
      const by = this.playerBaseScaleY;
      this.player.setScale(bx, by);

      this.tweens.add({
        targets: this.player,
        scaleX: bx * 1.1,
        scaleY: by * 0.9,
        duration: 80,
        yoyo: true,
        ease: "Quad.easeOut",
        onComplete: () => {
          this.player.setScale(bx, by);
        },
      });
    }
  }

  handleTap() {
    if (this.state === "idle") {
      this.startGame();
      return;
    }

    if (this.state === "play") {
      this.handleJump();
      return;
    }

    // ✅ При gameover — тап НЕ перезапускает напрямую
    // Перезапуск только через кнопку "Играть снова" или пробел
    // Это предотвращает случайный показ рекламы
  }

  // ✅ Рестарт с рекламой — вызывается ТОЛЬКО по явному действию пользователя
  restartWithAd() {
    if (this.state !== "gameover") return;

    const now = Date.now();
    const timeSinceLastAd = now - window.lastAdTime;
    const minAdInterval = 60000;

    if (timeSinceLastAd > minAdInterval) {
      window.lastAdTime = now;

      showFullscreenAd(
        () => {
          console.log("📺 Реклама открыта");
        },
        (wasShown) => {
          if (wasShown) {
            console.log("✅ Реклама показана");
          }
          showBanner();
          this.scene.restart();
        },
        (error) => {
          console.warn("⚠️ Ошибка рекламы:", error);
          showBanner();
          this.scene.restart();
        }
      );
    } else {
      console.log(`⏳ До следующей рекламы: ${Math.ceil((minAdInterval - timeSinceLastAd) / 1000)} сек`);
      showBanner();
      this.scene.restart();
    }
  }

  startGame() {
    this.state = "play";

    if (this.idleTween) {
      this.idleTween.stop();
      this.idleTween = null;
    }

    this.player.body.setAllowGravity(true);
    this.player.body.setGravityY(900);
    this.player.body.setVelocityY(-330);
    this.hintText.setVisible(false);

    this.time.delayedCall(1200, () => {
      if (this.state === "play") this.startSpawning();
    });
  }

  startSpawning() {
    if (this.spawnTimer) this.spawnTimer.remove(false);

    const minTimeBetween = (200 / this.scrollSpeed) * 1000;
    const safeInterval = Math.max(this.spawnInterval, minTimeBetween);

    this.spawnTimer = this.time.addEvent({
      delay: safeInterval,
      loop: true,
      callback: this.spawnPipePair,
      callbackScope: this,
    });

    this.spawnPipePair();
  }

  spawnPipePair() {
    if (this.state !== "play") return;

    const pipeW = 70;
    const gap = this.pipeGap;
    const minPipeH = 80;

    const absMin = minPipeH + gap / 2;
    const absMax = this.groundTop - minPipeH - gap / 2;

    const lo = Math.max(absMin, this.lastGapCenter - this.maxGapShift);
    const hi = Math.min(absMax, this.lastGapCenter + this.maxGapShift);

    const gapCenter = Phaser.Math.Between(lo, hi);
    this.lastGapCenter = gapCenter;

    const gapTopY = gapCenter - gap / 2;
    const gapBottomY = gapCenter + gap / 2;
    const x = WIDTH + pipeW;

    const color =
      this.buildingColors[
        Phaser.Math.Between(0, this.buildingColors.length - 1)
      ];
    const darkerColor = Phaser.Display.Color.ValueToColor(color).darken(15)
      .color;

    const topH = Math.max(10, gapTopY);
    const topBody = this.add.image(x, topH / 2, "px");
    topBody.setTint(color);
    topBody.setDisplaySize(pipeW, topH);
    topBody.setDepth(3);

    const topLedge = this.add.image(x, topH - 2, "px");
    topLedge.setTint(darkerColor);
    topLedge.setDisplaySize(pipeW + 8, 10);
    topLedge.setDepth(3);

    const topWindows = this.createWindows(x, 0, pipeW, topH);
    const topGroup = [topBody, topLedge, ...topWindows];

    const topMarker = {
      x: x,
      y: topH / 2,
      pipeW: pipeW + 8,
      pipeH: topH,
      scored: false,
      parts: topGroup,
    };

    const bottomH = Math.max(10, this.groundTop - gapBottomY);
    const botBody = this.add.image(x, gapBottomY + bottomH / 2, "px");
    botBody.setTint(color);
    botBody.setDisplaySize(pipeW, bottomH);
    botBody.setDepth(3);

    const botLedge = this.add.image(x, gapBottomY + 2, "px");
    botLedge.setTint(darkerColor);
    botLedge.setDisplaySize(pipeW + 8, 10);
    botLedge.setDepth(3);

    const botWindows = this.createWindows(x, gapBottomY, pipeW, bottomH);
    const botGroup = [botBody, botLedge, ...botWindows];

    const botMarker = {
      x: x,
      y: gapBottomY + bottomH / 2,
      pipeW: pipeW + 8,
      pipeH: bottomH,
      parts: botGroup,
    };

    this.pipeMarkers.push(topMarker);
    this.pipeMarkers.push(botMarker);
  }

  createWindows(centerX, topY, buildW, buildH) {
    const windows = [];
    const winW = 8;
    const winH = 10;
    const cols = 3;
    const spacingX = buildW / (cols + 1);
    const spacingY = 28;
    const rows = Math.floor((buildH - 20) / spacingY);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const wx = centerX - buildW / 2 + spacingX * (col + 1);
        const wy = topY + 15 + row * spacingY;

        const isLit = Math.random() > 0.4;
        const winColor = isLit ? 0xfff3b0 : 0x2a2a3a;
        const winAlpha = isLit ? 0.9 : 0.5;

        const win = this.add.image(wx, wy, "px");
        win.setTint(winColor);
        win.setDisplaySize(winW, winH);
        win.setAlpha(winAlpha);
        win.setDepth(4);

        windows.push(win);
      }
    }
    return windows;
  }

  die() {
    if (this.state === "gameover") return;
    this.state = "gameover";

    if (this.idleTween) {
      this.idleTween.stop();
      this.idleTween = null;
    }

    this.player.setScale(this.playerBaseScaleX, this.playerBaseScaleY);
    this.player.body.setVelocity(0, 0);
    this.player.body.setAllowGravity(false);

    if (this.spawnTimer) this.spawnTimer.remove(false);

    this.cameras.main.flash(200, 255, 100, 100);
    this.cameras.main.shake(300, 0.015);

    let isNewRecord = false;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.saveBestScore(this.bestScore);
      isNewRecord = true;
      submitScore(this.bestScore);
    }

    this.bestText.setText(t('best') + ": " + this.bestScore);
    this.scoreText.setVisible(false);

    this.panelScoreText.setText(t('yourScore') + ": " + this.score);
    this.panelBestText.setText(t('bestScore') + ": " + this.bestScore);
    this.newRecordText.setText(t('newRecord'));
    this.newRecordText.setVisible(isNewRecord);

    // ✅ Обновляем текст кнопки на текущем языке
    if (this.restartBtnText) {
      this.restartBtnText.setText(t('playAgain'));
    }

    this.gameOverPanel.setVisible(true);
    this.gameOverPanel.setAlpha(0);
    this.tweens.add({
      targets: this.gameOverPanel,
      alpha: 1,
      duration: 400,
      ease: "Quad.easeOut",
    });

    if (isNewRecord) {
      this.tweens.add({
        targets: this.newRecordText,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    if (this.hintText) {
      this.hintText.destroy();
      this.hintText = null;
    }

    hideBanner();
  }

  addScore() {
    this.score += 1;
    this.scoreText.setText(String(this.score));

    this.tweens.add({
      targets: this.scoreText,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 100,
      yoyo: true,
      ease: "Quad.easeOut",
    });

    if (this.score % 5 === 0) {
      this.scrollSpeed = Math.min(280, this.scrollSpeed + 12);

      const minGapByBird = this.player.body.height + this.gapPadding * 2;
      const minGapHard = 110;
      this.pipeGap = Math.max(minGapHard, minGapByBird, this.pipeGap - 6);

      this.spawnInterval = Math.max(950, this.spawnInterval - 30);
      this.maxGapShift = Math.max(80, this.maxGapShift - 5);

      this.startSpawning();
    }
  }

  rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return (
      ax - aw / 2 < bx + bw / 2 &&
      ax + aw / 2 > bx - bw / 2 &&
      ay - ah / 2 < by + bh / 2 &&
      ay + ah / 2 > by - bh / 2
    );
  }

  update(time, delta) {
    if (!this.player || !this.player.body) return;

    for (const cloud of this.clouds) {
      cloud.x -= cloud.cloudSpeed * (delta / 1000);
      if (cloud.x < -60) {
        cloud.x = WIDTH + 60;
        cloud.y = Phaser.Math.Between(30, HEIGHT / 2 - 50);
      }
    }

    if (this.playerShadow) {
      this.playerShadow.x = this.player.x;
      const dist = this.groundTop - this.player.y;
      const shadowScale = Phaser.Math.Clamp(1 - dist / 500, 0.3, 1);
      this.playerShadow.setDisplaySize(40 * shadowScale, 8 * shadowScale);
      this.playerShadow.setAlpha(0.15 * shadowScale);
    }

    if (this.state === "idle") return;
    if (this.state === "gameover") return;

    if (
      import.meta.env.MODE !== "production" &&
      window.bot?.enabled &&
      this.state === "play"
    ) {
      let shouldJump = false;

      if (this.player.body.velocity.y > 0 && this.player.y > HEIGHT / 2) {
        shouldJump = true;
      }

      for (const marker of this.pipeMarkers) {
        if (marker.scored === undefined) continue;

        if (marker.x > this.player.x - 50 && marker.x < this.player.x + 150) {
          const gapCenter = marker.y + marker.pipeH / 2 + this.pipeGap / 2;
          if (this.player.y > gapCenter + 20) {
            shouldJump = true;
          }
          break;
        }
      }

      if (shouldJump) {
        this.player.body.setVelocityY(-330);
      }
    }

    const vy = this.player.body.velocity.y;
    this.player.rotation = Phaser.Math.Clamp(vy / 600, -0.5, 0.8);

    if (this.player.y < 0) {
      this.player.y = 0;
      this.player.body.setVelocityY(0);
    }

    if (this.player.body.bottom >= this.groundTop) {
      this.die();
      return;
    }

    const speed = this.scrollSpeed * (delta / 1000);
    const px = this.player.body.center.x;
    const py = this.player.body.center.y;
    const pw = this.player.body.width;
    const ph = this.player.body.height;

    for (let i = this.pipeMarkers.length - 1; i >= 0; i--) {
      const marker = this.pipeMarkers[i];
      marker.x -= speed;

      for (const part of marker.parts) {
        part.x -= speed;
      }

      if (marker.x + marker.pipeW / 2 < -80) {
        for (const part of marker.parts) {
          part.destroy();
        }
        this.pipeMarkers.splice(i, 1);
        continue;
      }

      if (
        this.rectsOverlap(
          px,
          py,
          pw,
          ph,
          marker.x,
          marker.y,
          marker.pipeW,
          marker.pipeH
        )
      ) {
        this.die();
        return;
      }

      if (marker.scored !== undefined && !marker.scored) {
        if (marker.x + marker.pipeW / 2 < px - pw / 2) {
          marker.scored = true;
          this.addScore();
        }
      }
    }
  }
}

// ========================================
// === ЗАПУСК ИГРЫ                      ===
// ========================================
async function startGame() {
  let sdkLanguage = null;
  
  try {
    const sdk = await initYSDK();
    
    if (sdk) {
      sdkLanguage = getSDKLanguage();
      console.log("🌍 Язык из Яндекс SDK:", sdkLanguage);
    }
  } catch (e) {
    console.warn("⚠️ SDK недоступен, продолжаем без него:", e);
  }

  loadSavedLanguage(sdkLanguage);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: WIDTH,
    height: HEIGHT,
    parent: "app",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: 0 },
        debug: false,
      },
    },
    scene: [LanguageScene, BootScene, GameScene],
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: WIDTH,
      height: HEIGHT,
    },
    backgroundColor: "#64aff0",
  });

  // ========================================
  // === АДАПТИВНОЕ МАСШТАБИРОВАНИЕ       ===
  // ========================================
  function resizeGame() {
    const canvas = document.querySelector('#app canvas');
    if (!canvas) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const isPortrait = windowHeight >= windowWidth;

    let scale;

    if (isPortrait) {
      const scaleByWidth = windowWidth / WIDTH;
      const scaleByHeight = windowHeight / HEIGHT;
      
      if (scaleByWidth * HEIGHT <= windowHeight) {
        scale = scaleByWidth;
      } else {
        scale = scaleByHeight;
      }
    } else {
      scale = windowHeight / HEIGHT;
    }

    const canvasWidth = Math.floor(WIDTH * scale);
    const canvasHeight = Math.floor(HEIGHT * scale);

    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    canvas.style.position = 'absolute';
    canvas.style.left = Math.floor((windowWidth - canvasWidth) / 2) + 'px';
    canvas.style.top = Math.floor((windowHeight - canvasHeight) / 2) + 'px';
  }

  window.addEventListener('resize', resizeGame);
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeGame, 50);
    setTimeout(resizeGame, 200);
    setTimeout(resizeGame, 500);
  });

  function waitForCanvas() {
    const canvas = document.querySelector('#app canvas');
    if (canvas) {
      resizeGame();
    } else {
      requestAnimationFrame(waitForCanvas);
    }
  }
  waitForCanvas();

  setTimeout(resizeGame, 100);
  setTimeout(resizeGame, 300);
  setTimeout(resizeGame, 1000);
}

startGame();