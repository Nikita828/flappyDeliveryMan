import Phaser from "phaser";
import { initYSDK, showFullscreenAd, submitScore, showBanner, hideBanner, getBannerStatus } from "./ysdk.js";
import { LanguageScene } from "./LanguageScene.js";
import { t, setLanguage, getLanguage, loadSavedLanguage } from "./i18n.js";

const WIDTH = 360;
const HEIGHT = 640;
const GROUND_H = 80;

// ... остальной код без изменений


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

    // ИСПОЛЬЗУЕМ ПЕРЕВОД:
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

    // Безопасная загрузка рекорда
    this.bestScore = this.loadBestScore();

    this.buildingColors = [
      0x8b5e3c, 0xa0522d, 0x6b7b8d, 0x7a6655,
      0x9b7653, 0x5f7a8a, 0x8b7d6b, 0x6a5f50,
    ];

    // Счётчик смертей для рекламы
    if (this.deathCount === undefined) {
      this.deathCount = 0;
    }
  }

  // Безопасная работа с localStorage
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
  // Кнопка смены языка (в правом верхнем углу)
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

  // ========================================
  // === ТЕКСТУРА 1x1 БЕЛЫЙ ПИКСЕЛЬ      ===
  // ========================================
  if (!this.textures.exists("px")) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture("px", 1, 1);
    g.destroy();
  }

  // ========================================
  // === ГРАДИЕНТНОЕ НЕБО                 ===
  // ========================================
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

  // ========================================
  // === ОБЛАКА                           ===
  // ========================================
  this.clouds = [];
  this.createClouds();

  this.groundTop = HEIGHT - GROUND_H;

  // ========================================
  // === ЗЕМЛЯ                            ===
  // ========================================
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

  // ========================================
  // === ИГРОК                            ===
  // ========================================
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

  // ========================================
  // === МАССИВ МАРКЕРОВ ЗДАНИЙ           ===
  // ========================================
  this.pipeMarkers = [];

  // ========================================
  // === ТЕКСТ СЧЁТА                      ===
  // ========================================
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

  // ========================================
  // === ПОДСКАЗКА                        ===
  // ========================================
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

  // ========================================
  // === ПАНЕЛЬ GAME OVER                 ===
  // ========================================
  this.gameOverPanel = this.add
    .container(WIDTH / 2, HEIGHT / 2)
    .setDepth(200);
  this.gameOverPanel.setVisible(false);

  const panelGraphics = this.add.graphics();
  panelGraphics.fillStyle(0x1a1a2e, 0.85);
  panelGraphics.fillRoundedRect(-145, -110, 290, 220, 16);
  panelGraphics.lineStyle(2, 0xffffff, 0.2);
  panelGraphics.strokeRoundedRect(-145, -110, 290, 220, 16);

  const goTitle = this.add
    .text(0, -75, t('gameOver'), {
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
  divider.lineBetween(-100, -48, 100, -48);

  this.panelScoreText = this.add
    .text(0, -25, "", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 2,
    })
    .setOrigin(0.5);

  this.panelBestText = this.add
    .text(0, 10, "", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffd93d",
      stroke: "#000000",
      strokeThickness: 2,
    })
    .setOrigin(0.5);

  this.newRecordText = this.add
    .text(0, 50, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffd93d",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    })
    .setOrigin(0.5);

  this.gameOverPanel.add([
    panelGraphics,
    goTitle,
    divider,
    this.panelScoreText,
    this.panelBestText,
    this.newRecordText,
  ]);

  // ========================================
  // === ОБРАБОТКА НАЖАТИЙ                ===
  // ========================================
  this.input.on("pointerdown", this.handleTap, this);
  this.input.addPointer(2);

  // ========================================
  // === ПАУЗА ПРИ ПОТЕРЕ ФОКУСА          ===
  // ========================================
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

  // ========================================
  // === STICKY БАННЕР                    ===
  // ========================================
  this.time.delayedCall(1000, () => {
    showBanner().then((result) => {
      if (result.stickyAdvIsShowing) {
        console.log("✅ Баннер активен");
      } else if (result.reason) {
        console.log("ℹ️ Баннер не показан:", result.reason);
      }
    });
  });

  // ========================================
  // === ОТЛАДКА (ТОЛЬКО В DEV)           ===
  // ========================================
  if (import.meta.env.MODE !== "production") {
    this.setupDebugTools();
  }
}

  // ========================================
  // === ОТЛАДОЧНЫЕ ИНСТРУМЕНТЫ           ===
  // ========================================
  // Метод setupDebugTools ПОСЛЕ create(), но ВНУТРИ класса GameScene
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
        this.bestText.setText("Рекорд: 0");
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

  handleTap() {
  // --- Состояние "ожидание" → начинаем игру ---
  if (this.state === "idle") {
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
    return;
  }

  // --- Состояние "играем" → прыжок ---
  if (this.state === "play") {
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
    return;
  }

  // --- Состояние "проиграли" → перезапуск ---
  if (this.state === "gameover") {
    // ДОБАВЛЕНО: Показываем баннер обратно при перезапуске
    showBanner();
    
    // Перезапускаем сцену
    this.scene.restart();
  }
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

    // Верхнее здание
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

    // Нижнее здание
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

    // Отправляем в лидерборд
    submitScore(this.bestScore);
  }

  this.bestText.setText(t('best') + ": " + this.bestScore);
  this.scoreText.setVisible(false);

  this.panelScoreText.setText(t('yourScore') + ": " + this.score);
  this.panelBestText.setText(t('bestScore') + ": " + this.bestScore);
  this.newRecordText.setText(t('newRecord'));
  this.newRecordText.setVisible(isNewRecord);

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

  // Безопасно удаляем старый текст
  if (this.hintText) {
    this.hintText.destroy();
    this.hintText = null;
  }

  // Создаём новый текст подсказки
  this.hintText = this.add.text(
    WIDTH / 2,
    HEIGHT / 2 + 80,
    t('tapToRestart'),
    {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffd93d",
      stroke: "#000000",
      strokeThickness: 3,
      padding: { x: 10, y: 5 },
    }
  );

  this.hintText.setOrigin(0.5);
  this.hintText.setDepth(201);
  this.hintText.setVisible(true);
  this.hintText.setAlpha(1);

  // Анимация мигания
  this.tweens.add({
    targets: this.hintText,
    alpha: 0.4,
    duration: 800,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // ДОБАВЛЕНО: Скрываем баннер при Game Over
  hideBanner();

  // Показываем рекламу каждую 3-ю смерть
  this.deathCount = (this.deathCount || 0) + 1;

  if (this.deathCount % 3 === 0) {
    showFullscreenAd(
      () => {
        // onOpen — пауза
        this.scene.pause();
      },
      (wasShown) => {
        // onClose — продолжить
        this.scene.resume();
        
        // Логирование
        if (wasShown) {
          console.log("✅ Реклама была показана");
        } else {
          console.log("⚠️ Реклама не показалась (слишком частый вызов)");
        }
      },
      (error) => {
        // onError — обработка ошибки
        console.warn("⚠️ Реклама не показана:", error);
        this.scene.resume();
      }
    );
  }
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

    // Облака двигаются всегда
    for (const cloud of this.clouds) {
      cloud.x -= cloud.cloudSpeed * (delta / 1000);
      if (cloud.x < -60) {
        cloud.x = WIDTH + 60;
        cloud.y = Phaser.Math.Between(30, HEIGHT / 2 - 50);
      }
    }

    // Тень под птичкой
    if (this.playerShadow) {
      this.playerShadow.x = this.player.x;
      const dist = this.groundTop - this.player.y;
      const shadowScale = Phaser.Math.Clamp(1 - dist / 500, 0.3, 1);
      this.playerShadow.setDisplaySize(40 * shadowScale, 8 * shadowScale);
      this.playerShadow.setAlpha(0.15 * shadowScale);
    }

    if (this.state === "idle") return;
    if (this.state === "gameover") return;

    // Автоплей бот (только в dev-режиме)
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

    // Наклон птички
    const vy = this.player.body.velocity.y;
    this.player.rotation = Phaser.Math.Clamp(vy / 600, -0.5, 0.8);

    // Ограничение сверху
    if (this.player.y < 0) {
      this.player.y = 0;
      this.player.body.setVelocityY(0);
    }

    // Столкновение с землёй
    if (this.player.body.bottom >= this.groundTop) {
      this.die();
      return;
    }

    // Движение зданий
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
// В конце файла src/main.js

async function startGame() {
  let sdkLanguage = null;
  
  try {
    // Инициализируем SDK
    const sdk = await initYSDK();
    
    if (sdk) {
      // Получаем язык из SDK
      sdkLanguage = getSDKLanguage();
      console.log("🌍 Язык из Яндекс SDK:", sdkLanguage);
    }
  } catch (e) {
    console.warn("⚠️ SDK недоступен, продолжаем без него:", e);
  }

  // Загружаем язык (с приоритетом SDK)
  loadSavedLanguage(sdkLanguage);

  new Phaser.Game({
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
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    backgroundColor: "#64aff0",
  });
}

startGame();