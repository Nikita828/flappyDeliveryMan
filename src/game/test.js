import { describe, it, expect, beforeEach } from 'vitest';

// Мок для Phaser (без реального рендеринга)
const createMockScene = () => ({
  state: "idle",
  score: 0,
  bestScore: 0,
  scrollSpeed: 170,
  pipeGap: 170,
  maxGapShift: 120,
  lastGapCenter: 320,
  groundTop: 560,
  gapPadding: 22,
  
  player: {
    body: {
      height: 36,
      width: 50,
      center: { x: 90, y: 200 },
    },
    y: 200,
  },
  
  pipeMarkers: [],
});

// Копируем логику из игры для тестирования
const rectsOverlap = (ax, ay, aw, ah, bx, by, bw, bh) => {
  return (
    ax - aw / 2 < bx + bw / 2 &&
    ax + aw / 2 > bx - bw / 2 &&
    ay - ah / 2 < by + bh / 2 &&
    ay + ah / 2 > by - bh / 2
  );
};

const calculateGapBounds = (scene) => {
  const minPipeH = 80;
  const gap = scene.pipeGap;
  const absMin = minPipeH + gap / 2;
  const absMax = scene.groundTop - minPipeH - gap / 2;
  const lo = Math.max(absMin, scene.lastGapCenter - scene.maxGapShift);
  const hi = Math.min(absMax, scene.lastGapCenter + scene.maxGapShift);
  return { lo, hi, absMin, absMax };
};

// ========================================
// === ТЕСТЫ                            ===
// ========================================

describe("Flappy Bird Game Logic", () => {
  
  describe("Collision Detection", () => {
    it("должен обнаружить столкновение перекрывающихся прямоугольников", () => {
      expect(rectsOverlap(100, 100, 50, 50, 120, 100, 50, 50)).toBe(true);
    });
    
    it("не должен обнаружить столкновение далёких прямоугольников", () => {
      expect(rectsOverlap(100, 100, 50, 50, 300, 100, 50, 50)).toBe(false);
    });
    
    it("должен обнаружить касание краями", () => {
      expect(rectsOverlap(100, 100, 50, 50, 149, 100, 50, 50)).toBe(true);
    });
    
    it("не должен обнаружить столкновение при касании ровно краями", () => {
      expect(rectsOverlap(100, 100, 50, 50, 150, 100, 50, 50)).toBe(false);
    });
  });
  
  describe("Gap Generation", () => {
    it("щель должна быть в допустимых границах", () => {
      const scene = createMockScene();
      const { lo, hi, absMin, absMax } = calculateGapBounds(scene);
      
      expect(lo).toBeGreaterThanOrEqual(absMin);
      expect(hi).toBeLessThanOrEqual(absMax);
      expect(hi).toBeGreaterThan(lo);
    });
    
    it("щель должна быть достаточной для пролёта птички", () => {
      const scene = createMockScene();
      const minRequired = scene.player.body.height + scene.gapPadding * 2;
      
      expect(scene.pipeGap).toBeGreaterThanOrEqual(minRequired);
    });
    
    it("после усложнения щель не должна стать слишком маленькой", () => {
      const scene = createMockScene();
      const minGapHard = 110;
      const minGapByBird = scene.player.body.height + scene.gapPadding * 2;
      
      // Симулируем 20 усложнений
      for (let i = 0; i < 20; i++) {
        scene.pipeGap = Math.max(minGapHard, minGapByBird, scene.pipeGap - 6);
      }
      
      expect(scene.pipeGap).toBeGreaterThanOrEqual(minGapHard);
      expect(scene.pipeGap).toBeGreaterThanOrEqual(minGapByBird);
    });
  });
  
  describe("Difficulty Scaling", () => {
    it("скорость не должна превышать максимум", () => {
      const scene = createMockScene();
      const maxSpeed = 280;
      
      // Симулируем 50 усложнений
      for (let i = 0; i < 50; i++) {
        scene.scrollSpeed = Math.min(maxSpeed, scene.scrollSpeed + 12);
      }
      
      expect(scene.scrollSpeed).toBeLessThanOrEqual(maxSpeed);
    });
    
    it("maxGapShift не должен стать слишком маленьким", () => {
      const scene = createMockScene();
      const minShift = 80;
      
      for (let i = 0; i < 50; i++) {
        scene.maxGapShift = Math.max(minShift, scene.maxGapShift - 5);
      }
      
      expect(scene.maxGapShift).toBeGreaterThanOrEqual(minShift);
    });
  });
  
  describe("Score System", () => {
    it("очко засчитывается когда здание проходит птичку", () => {
      const scene = createMockScene();
      const marker = {
        x: 50,  // здание левее птички
        pipeW: 78,
        scored: false,
      };
      
      const px = scene.player.body.center.x; // 90
      const pw = scene.player.body.width;    // 50
      
      // Проверка из update()
      if (marker.x + marker.pipeW / 2 < px - pw / 2) {
        marker.scored = true;
        scene.score += 1;
      }
      
      // marker.x + 39 = 89 < 90 - 25 = 65? Нет
      // Сдвинем здание левее
      marker.x = 0;
      if (marker.x + marker.pipeW / 2 < px - pw / 2) {
        marker.scored = true;
        scene.score += 1;
      }
      
      // 0 + 39 = 39 < 65? Да!
      expect(marker.scored).toBe(true);
      expect(scene.score).toBe(1);
    });
  });
  
});

describe("Edge Cases", () => {
  it("птичка не должна улететь выше экрана", () => {
    const scene = createMockScene();
    scene.player.y = -50;
    
    // Логика из update()
    if (scene.player.y < 0) {
      scene.player.y = 0;
    }
    
    expect(scene.player.y).toBe(0);
  });
  
  it("состояние gameover не должно вызываться дважды", () => {
    const scene = createMockScene();
    let dieCallCount = 0;
    
    const die = () => {
      if (scene.state === "gameover") return;
      scene.state = "gameover";
      dieCallCount++;
    };
    
    die();
    die();
    die();
    
    expect(dieCallCount).toBe(1);
  });
});