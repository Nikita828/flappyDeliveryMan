import Phaser from "phaser"; // подключаем движок Phaser (ESM импорт)

const WIDTH = 360;          // логическая ширина игры (в пикселях)
const HEIGHT = 640;         // логическая высота игры
const GROUND_H = 80;        // высота "земли" (полосы внизу), НЕ физический объект — просто отрисовка + проверка

class GameScene extends Phaser.Scene {
  constructor() {
    super("game");          // ключ сцены (по нему можно переключаться/рестартить)
  }

  init() {
    this.state = "idle";    // состояние игры: idle -> play -> gameover
    this.score = 0;         // текущий счёт
    this.scrollSpeed = 170; // скорость движения препятствий влево
    this.pipeGap = 170;     // размер "окна" между верхним и нижним препятствием
    this.spawnInterval = 1400; // как часто спавнить пару препятствий (мс)
    this.spawnTimer = null; // ссылка на таймер спавна, чтобы потом остановить

    // Загружаем рекорд из localStorage
    const saved = localStorage.getItem("flappy-best"); // читаем строку из хранилища браузера
    this.bestScore = saved ? parseInt(saved, 10) : 0;  // переводим в число, если есть, иначе 0
  }

  preload() {
    this.load.image("bird", "assets/bird.png");   // загружаем спрайт игрока по ключу "bird"
    this.load.image("build", "assets/build.png"); // загружаем спрайт "дома" (препятствия) по ключу "build"
  }

  create() {
    this.cameras.main.setBackgroundColor("#87CEEB"); // цвет фона камеры (голубое небо)

    // Создаём 1x1 белый пиксель, чтобы потом масштабировать его под прямоугольники (земля, панель и т.д.)
    // Это удобно, чтобы не хранить отдельные png для простых прямоугольников.
    if (!this.textures.exists("px")) {
      const g = this.make.graphics({ x: 0, y: 0, add: false }); // временная graphics-рисовалка (не добавляем на сцену)
      g.fillStyle(0xffffff, 1);  // белый цвет
      g.fillRect(0, 0, 1, 1);    // рисуем 1x1
      g.generateTexture("px", 1, 1); // сохраняем как текстуру "px"
      g.destroy();               // очищаем временный graphics
    }

    this.groundTop = HEIGHT - GROUND_H; // Y-координата верхней границы земли (всё что ниже — земля)

    // Земля (это только картинка; физики у земли нет)
    this.add
      .image(WIDTH / 2, HEIGHT - GROUND_H / 2, "px") // ставим прямоугольник-пиксель по центру земли
      .setTint(0x2ecc71)                              // красим в зелёный
      .setDisplaySize(WIDTH, GROUND_H)                // растягиваем до размера земли
      .setDepth(5);                                   // слой отрисовки (больше — выше)

    // Игрок (физический объект Arcade Physics)
    this.player = this.physics.add.image(90, HEIGHT / 3, "bird"); // создаём physics image
    // this.player.setTint(0xf1c40f); // можно было бы перекрасить спрайт (сейчас выключено)
    this.player.setDisplaySize(110, 70); // ВАЖНО: это растягивает картинку до 110x70 (может "раздувать" персонажа)
    this.player.setDepth(10);            // рисуем поверх земли и препятствий (если их depth меньше)
    this.player.body.setAllowGravity(false); // в idle гравитация выключена (иначе упадёт до старта)
    this.player.body.setSize(50, 36);        // задаём размер физ.хитбокса игрока (не равен displaySize)
    this.player.body.setOffset(-25 + 0.5, -18 + 0.5);
    // offset — сдвиг хитбокса относительно origin тела.
    // Здесь хитбокс вручную "центрируется" странным способом (с отрицательным оффсетом).
    // Это тонкое место: если оффсет неверный, будут "нечестные" столкновения.

    // Трубы/дома (группа обычных display-объектов, НЕ physics)
    this.pipes = this.add.group();
    // ВАЖНО: раз pipes НЕ physics, столкновения делаются вручную через rectsOverlap в update().

    // Счёт — текущий (сверху по центру)
    this.scoreText = this.add
      .text(WIDTH / 2, 40, "0", {
        fontFamily: "Arial",
        fontSize: "40px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)  // центрируем текст относительно точки (x,y)
      .setDepth(100);  // рисуем поверх почти всего

    // Рекорд — маленький текст под счётом
    this.bestText = this.add
      .text(WIDTH / 2, 75, "Best: " + this.bestScore, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(100);

    // Подсказка для старта/рестарта
    this.hintText = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 60, "Tap to start", {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(100);

    // Панель Game Over (контейнер, чтобы двигать/скрывать всё сразу)
    this.gameOverPanel = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(200);
    this.gameOverPanel.setVisible(false); // изначально скрыта

    // Фон панели (чёрный полупрозрачный прямоугольник из "px")
    const panelBg = this.add.image(0, 0, "px");
    panelBg.setTint(0x000000);
    panelBg.setDisplaySize(280, 200);
    panelBg.setAlpha(0.7);

    // Заголовок "GAME OVER"
    const goTitle = this.add
      .text(0, -60, "GAME OVER", {
        fontFamily: "Arial",
        fontSize: "32px",
        color: "#ff4444",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Текст счёта на панели (заполняется при смерти)
    this.panelScoreText = this.add
      .text(0, -10, "", {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Текст рекорда на панели (заполняется при смерти)
    this.panelBestText = this.add
      .text(0, 25, "", {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#ffd700",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Текст "новый рекорд!"
    this.newRecordText = this.add
      .text(0, 58, "⭐ NEW RECORD! ⭐", {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#ffd700",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Складываем элементы в контейнер (их координаты теперь локальные относительно контейнера)
    this.gameOverPanel.add([
      panelBg,
      goTitle,
      this.panelScoreText,
      this.panelBestText,
      this.newRecordText,
    ]);

    // Обработчик тапа/клика
    this.input.on("pointerdown", this.handleTap, this); // this — контекст, чтобы внутри handleTap работал this.*
  }

  handleTap() {
    if (this.state === "idle") {
      this.state = "play";                 // переключаемся в игру
      this.player.body.setAllowGravity(true); // включаем гравитацию
      this.player.body.setGravityY(900);      // величина гравитации (ускорение вниз)
      this.player.body.setVelocityY(-330);    // "прыжок" вверх
      this.hintText.setVisible(false);        // убираем подсказку "Tap to start"

      // запускаем спавн не сразу, а через 1.2 сек, чтобы игрок успел "войти" в игру
      this.time.delayedCall(1200, () => {
        if (this.state === "play") this.startSpawning(); // на случай если уже умерли/рестартнули
      });
      return;
    }

    if (this.state === "play") {
      this.player.body.setVelocityY(-330); // во время игры тап = прыжок
      return;
    }

    if (this.state === "gameover") {
      this.scene.restart(); // перезапуск сцены (всё init/create заново)
    }
  }

  startSpawning() {
    if (this.spawnTimer) this.spawnTimer.remove(false); // если таймер уже был — убрать, чтобы не было двух таймеров

    // запускаем повторяющийся таймер спавна
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnInterval,   // период
      loop: true,                  // повторять бесконечно
      callback: this.spawnPipePair,// что вызывать
      callbackScope: this,         // контекст this внутри spawnPipePair
    });

    this.spawnPipePair(); // сразу спавним первую пару, не ждём delay
  }

  spawnPipePair() {
    if (this.state !== "play") return; // не спавним, если игра не в play

    const pipeW = 70;   // ширина препятствия (и визуальная, и для коллизии/скоринга в этом коде)
    const minMargin = 0; // минимальный отступ сверху/снизу для центра зазора
    const gap = this.pipeGap; // размер щели между верхним и нижним препятствием

    // Выбираем вертикальную позицию центра зазора случайно,
    // но так, чтобы щель полностью помещалась между потолком (0) и землёй (groundTop),
    // с учётом minMargin.
    const gapCenter = Phaser.Math.Between(
      minMargin + gap / 2,
      this.groundTop - minMargin - gap / 2
    );

    const gapTopY = gapCenter - gap / 2;      // Y нижнего края верхнего дома
    const gapBottomY = gapCenter + gap / 2;   // Y верхнего края нижнего дома
    const x = WIDTH + pipeW;                  // стартовая X позиция справа за экраном

    // Высота верхнего дома: от потолка (0) до gapTopY
    // Math.max(10, ...) гарантирует минимум 10px, чтобы не было нулевой/отрицательной высоты
    const topH = Math.max(10, gapTopY);

    // Верхний дом рисуем так, чтобы его центр был на topH/2 (тогда верх будет около 0)
    const topPipe = this.add.image(x, topH / 2, "build");
    topPipe.setDisplaySize(pipeW, topH); // растягиваем build.png под нужный прямоугольник (может "плющить" текстуру)
    topPipe.setFlipY(true);              // переворачиваем по вертикали (как верхняя труба)
    topPipe.scored = false;              // флаг для начисления очка (будет использоваться только у верхнего дома)
    topPipe.pipeW = pipeW;               // сохраняем размеры для ручной коллизии/удаления
    topPipe.pipeH = topH;

    // Высота нижнего дома: от gapBottomY до земли (groundTop)
    const bottomH = Math.max(10, this.groundTop - gapBottomY);
    const botPipe = this.add.image(x, gapBottomY + bottomH / 2, "build");
    botPipe.setDisplaySize(pipeW, bottomH); // растягиваем под высоту
    botPipe.pipeW = pipeW;                  // сохраняем размеры для ручной коллизии/удаления
    botPipe.pipeH = bottomH;

    // Добавляем оба препятствия в группу, чтобы потом в update() двигать/проверять
    this.pipes.add(topPipe);
    this.pipes.add(botPipe);
  }

  die() {
    if (this.state === "gameover") return; // защита от повторных вызовов
    this.state = "gameover";              // фиксируем состояние

    this.player.body.setVelocity(0, 0);       // останавливаем игрока
    this.player.body.setAllowGravity(false);  // выключаем гравитацию, чтобы не падал дальше

    if (this.spawnTimer) this.spawnTimer.remove(false); // останавливаем спавн препятствий

    // Проверяем и сохраняем рекорд
    let isNewRecord = false;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem("flappy-best", String(this.bestScore)); // пишем в localStorage
      isNewRecord = true;
    }

    this.bestText.setText("Best: " + this.bestScore); // обновляем верхний рекорд

    this.scoreText.setVisible(false); // скрываем большой счёт сверху

    // Заполняем и показываем панель Game Over
    this.panelScoreText.setText("Score: " + this.score);
    this.panelBestText.setText("Best: " + this.bestScore);
    this.newRecordText.setVisible(isNewRecord);
    this.gameOverPanel.setVisible(true);

    this.hintText.setText("Tap to restart").setVisible(true); // подсказка на рестарт
  }

  addScore() {
    this.score += 1;                       // увеличиваем счёт
    this.scoreText.setText(String(this.score)); // обновляем текст

    // Каждые 5 очков повышаем сложность:
    // скорость ↑, щель ↓, интервал спавна ↓
    if (this.score % 5 === 0) {
      this.scrollSpeed = Math.min(280, this.scrollSpeed + 12);
      this.pipeGap = Math.max(120, this.pipeGap - 6);
      this.spawnInterval = Math.max(950, this.spawnInterval - 30);
      this.startSpawning(); // перезапускаем таймер с новым интервалом
    }
  }

  // Самописная проверка пересечения двух прямоугольников,
  // где (x,y) — центр прямоугольника, а (w,h) — его размеры.
  rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return (
      ax - aw / 2 < bx + bw / 2 &&
      ax + aw / 2 > bx - bw / 2 &&
      ay - ah / 2 < by + bh / 2 &&
      ay + ah / 2 > by - bh / 2
    );
  }

  update(time, delta) {
    if (!this.player || !this.player.body) return; // на всякий случай (если объект ещё не создан/уничтожен)
    if (this.state === "idle") return;             // до старта не обновляем механику
    if (this.state === "gameover") return;         // после смерти не двигаем препятствия/игрока (кроме того, что уже отключено)

    const vy = this.player.body.velocity.y; // текущая вертикальная скорость игрока
    this.player.rotation = Phaser.Math.Clamp(vy / 600, -0.5, 0.8); // поворот спрайта (наклон вниз при падении)

    // Не даём улетать выше потолка
    if (this.player.y < 0) {
      this.player.y = 0;
      this.player.body.setVelocityY(0);
    }

    // Проверка на землю: "18" — это вручную подобранный радиус/половина высоты,
    // чтобы считать касание земли. ВАЖНО: если sprite/hitbox меняются, это число может стать неправильным.
    if (this.player.y + 18 >= this.groundTop) {
      this.die();
      return;
    }

    const speed = this.scrollSpeed * (delta / 1000); // сколько пикселей сдвинуть за кадр (нормализация по delta)

    // Параметры прямоугольника игрока для ручной коллизии с домами:
    const px = this.player.x;
    const py = this.player.y;
    const pw = 40; // ширина хитбокса в ручной коллизии (НЕ связана автоматически с physics body)
    const ph = 28; // высота хитбокса в ручной коллизии
    // ВАЖНО: тут конфликт возможен:
    // physics-body игрока у тебя (50x36), а ручная коллизия считает (40x28).
    // Поэтому "смерть только при касании" может ощущаться неидеально.

    const children = this.pipes.getChildren(); // получаем массив всех препятствий

    for (let i = children.length - 1; i >= 0; i--) {
      const pipe = children[i];

      pipe.x -= speed; // двигаем препятствие влево

      // Удаляем препятствие, когда оно далеко за левым краем (чтобы не копились объекты)
      if (pipe.x + pipe.pipeW / 2 < -60) {
        pipe.destroy();
        continue;
      }

      // Ручная проверка столкновения игрока с каждым препятствием
      if (
        this.rectsOverlap(
          px, py, pw, ph,                 // игрок
          pipe.x, pipe.y, pipe.pipeW, pipe.pipeH // препятствие
        )
      ) {
        this.die();
        return;
      }

      // Начисление очков: только для верхнего препятствия (у него есть pipe.scored)
      // Когда препятствие полностью прошло игрока справа налево — +1 очко.
      if (pipe.scored !== undefined && !pipe.scored) {
        if (pipe.x + pipe.pipeW / 2 < px - pw / 2) {
          pipe.scored = true;
          this.addScore();
        }
      }
    }
  }
}

// Создание экземпляра игры Phaser
new Phaser.Game({
  type: Phaser.AUTO, // Phaser сам выберет WebGL или Canvas
  width: WIDTH,
  height: HEIGHT,
  parent: "app",     // id DOM-элемента, куда вставлять canvas
  physics: {
    default: "arcade", // используем Arcade Physics
    arcade: {
      gravity: { y: 0 }, // глобальная гравитация отключена (ты включаешь её только игроку вручную)
      debug: false,      // если true — покажет хитбоксы и столкновения
    },
  },
  scene: [GameScene], // список сцен, первая запустится автоматически
  scale: {
    mode: Phaser.Scale.FIT,              // вписываем игру в контейнер, сохраняя пропорции
    autoCenter: Phaser.Scale.CENTER_BOTH,// центрируем по горизонтали и вертикали
  },
});