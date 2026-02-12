// src/LanguageScene.js

import Phaser from "phaser";
import { setLanguage, loadSavedLanguage, getLanguage } from "./i18n.js";
import { getSDKLanguage } from "./ysdk.js";

const WIDTH = 360;
const HEIGHT = 640;

export class LanguageScene extends Phaser.Scene {
  constructor() {
    super("language");
  }

  create() {
    // Получаем язык из SDK
    const sdkLanguage = getSDKLanguage();
    
    // Если SDK вернул язык - используем его и пропускаем выбор
    if (sdkLanguage) {
      console.log("✅ Язык определён через SDK:", sdkLanguage);
      loadSavedLanguage(sdkLanguage);
      this.scene.start("boot");
      return;
    }
    
    // Если есть сохранённый выбор - используем его
    if (localStorage.getItem('game-language')) {
      console.log("✅ Используем сохранённый язык");
      this.scene.start("boot");
      return;
    }

    // Показываем экран выбора только если нет SDK и нет сохранённого выбора
    console.log("🌍 Показываем экран выбора языка");
    this.showLanguageSelection();
  }

  showLanguageSelection() {
    // Градиентное небо
    const skyGraphics = this.add.graphics();
    const skySteps = 20;
    const stepH = HEIGHT / skySteps;

    for (let i = 0; i < skySteps; i++) {
      const t = i / skySteps;
      const r = Math.round(100 + t * 75);
      const g = Math.round(170 + t * 55);
      const b = Math.round(230 + t * 25);
      const color = (r << 16) | (g << 8) | b;
      skyGraphics.fillStyle(color, 1);
      skyGraphics.fillRect(0, i * stepH, WIDTH, stepH + 1);
    }

    this.add.text(WIDTH / 2, 120, "🌍", {
      fontSize: "80px",
    }).setOrigin(0.5);

    this.add.text(WIDTH / 2, 220, "Select Language\nВыберите язык\nDil Seçin", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
      align: "center",
      stroke: "#2c3e50",
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.createLanguageButton(WIDTH / 2, 320, "🇷🇺 Русский", "ru");
    this.createLanguageButton(WIDTH / 2, 400, "🇬🇧 English", "en");
    this.createLanguageButton(WIDTH / 2, 480, "🇹🇷 Türkçe", "tr");
  }

  createLanguageButton(x, y, text, lang) {
    const button = this.add.graphics();
    button.fillStyle(0xffffff, 0.2);
    button.fillRoundedRect(x - 140, y - 30, 280, 60, 10);
    button.lineStyle(2, 0xffffff, 0.5);
    button.strokeRoundedRect(x - 140, y - 30, 280, 60, 10);

    const buttonText = this.add.text(x, y, text, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#2c3e50",
      strokeThickness: 3,
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, 280, 60).setOrigin(0.5);
    zone.setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      button.clear();
      button.fillStyle(0xffffff, 0.4);
      button.fillRoundedRect(x - 140, y - 30, 280, 60, 10);
      button.lineStyle(3, 0xffffff, 0.8);
      button.strokeRoundedRect(x - 140, y - 30, 280, 60, 10);
      buttonText.setScale(1.05);
    });

    zone.on('pointerout', () => {
      button.clear();
      button.fillStyle(0xffffff, 0.2);
      button.fillRoundedRect(x - 140, y - 30, 280, 60, 10);
      button.lineStyle(2, 0xffffff, 0.5);
      button.strokeRoundedRect(x - 140, y - 30, 280, 60, 10);
      buttonText.setScale(1);
    });

    zone.on('pointerdown', () => {
      this.tweens.add({
        targets: buttonText,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 100,
        yoyo: true,
        onComplete: () => {
          setLanguage(lang);
          this.scene.start("boot");
        }
      });
    });
  }
}