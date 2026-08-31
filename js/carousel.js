// =========================================================================
// КЛАСС ДЛЯ ПЕРВОЙ (ЛИНЕЙНОЙ) КАРУСЕЛИ
// =========================================================================
class LinearCarousel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.track = this.container.querySelector(".carousel-track");
    this.prevBtn = this.container.querySelector(".prev-btn");
    this.nextBtn = this.container.querySelector(".next-btn");

    this.originalItems = Array.from(this.track.children);
    this.itemsCount = this.originalItems.length;
    this.images = this.track.querySelectorAll("img");

    this.isTransitioning = false;
    this.autoplayTimer = null;
    this.eventsBound = false; // Флаг для контроля слушателей

    const imagePromises = Array.from(this.images).map((img) => {
      return new Promise((resolve) => {
        if (img.complete) resolve();
        else {
          img.addEventListener("load", resolve);
          img.addEventListener("error", resolve);
        }
      });
    });

    // Используем requestAnimationFrame, чтобы дождаться отрисовки интерфейса браузером
    Promise.all(imagePromises).then(() => {
      requestAnimationFrame(() => this.init());
    });
  }

  getVisibleItemsCount() {
    const width = window.innerWidth;
    if (width <= 480) return 1;
    if (width <= 768) return 2;
    if (width <= 1024) return 3;
    return 4;
  }

  init() {
    this.track.innerHTML = "";
    this.visibleCount = this.getVisibleItemsCount();

    const startClones = this.originalItems
      .slice(0, this.visibleCount)
      .map((el) => el.cloneNode(true));
    const endClones = this.originalItems
      .slice(-this.visibleCount)
      .map((el) => el.cloneNode(true));

    endClones.forEach((clone) => this.track.appendChild(clone));
    this.originalItems.forEach((item) => this.track.appendChild(item));
    startClones.forEach((clone) => this.track.appendChild(clone));

    this.currentIndex = this.visibleCount;

    // Даем браузеру один кадр на вставку DOM, прежде чем считать геометрию
    requestAnimationFrame(() => {
      this.updatePosition(true);
      this.startAutoplay();
      // Привязываем события только один раз, а не при каждом resize
      if (!this.eventsBound) {
        this.bindEvents();
        this.eventsBound = true;
      }
    });
  }

  updatePosition(instant = false) {
    const allItems = this.track.children;
    if (!allItems.length) return;

    const wrapperWidth = this.container
      .querySelector(".carousel-track-wrapper")
      .getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(this.track).gap) || 0;
    // Вычисляем чистую ширину одного слайда с учетом отступов
    const itemWidth =
      (wrapperWidth - gap * (this.visibleCount - 1)) / this.visibleCount;

    // Применяем вычисленную ширину к элементам, чтобы флекс их не раздувал
    Array.from(allItems).forEach((item) => {
      item.style.width = `${itemWidth}px`;
      item.style.flexShrink = "0";
    });

    const moveAmount = (itemWidth + gap) * this.currentIndex;

    if (instant) {
      this.track.classList.add("no-transition");
      this.track.offsetHeight; // Принудительный reflow
    } else {
      this.track.classList.remove("no-transition");
    }

    this.track.style.transform = `translateX(-${moveAmount}px)`;
  }

  startAutoplay() {
    this.stopAutoplay();
    this.autoplayTimer = setInterval(() => {
      if (this.isTransitioning) return;
      this.isTransitioning = true;
      this.currentIndex++;
      this.updatePosition();
    }, 3000);
  }

  stopAutoplay() {
    if (this.autoplayTimer) clearInterval(this.autoplayTimer);
  }

  bindEvents() {
    this.nextBtn.addEventListener("click", () => {
      if (this.isTransitioning) return;
      this.stopAutoplay();
      this.isTransitioning = true;
      this.currentIndex++;
      this.updatePosition();
      this.startAutoplay();
    });

    this.prevBtn.addEventListener("click", () => {
      if (this.isTransitioning) return;
      this.stopAutoplay();
      this.isTransitioning = true;
      this.currentIndex--;
      this.updatePosition();
      this.startAutoplay();
    });

    this.track.addEventListener("transitionend", (e) => {
      if (e.target !== this.track) return;

      // КОРРЕКЦИЯ ЛОГИКИ БЕСКОНЕЧНОГО СКРОЛЛА:
      // 1. Если ушли за правый край (в клоны старта)
      if (this.currentIndex >= this.itemsCount + this.visibleCount) {
        this.currentIndex = this.visibleCount;
        this.updatePosition(true);
      }
      // 2. Если ушли за левый край (в клоны конца)
      // ОШИБКА БЫЛА ТУТ: прыгать нужно строго на позицию оригинального последнего элемента
      if (this.currentIndex < this.visibleCount) {
        this.currentIndex = this.itemsCount;
        this.updatePosition(true);
      }
      this.isTransitioning = false;
    });

    this.container.addEventListener("mouseenter", () => this.stopAutoplay());
    this.container.addEventListener("mouseleave", () => this.startAutoplay());

    let resizeTimeout;
    window.addEventListener("resize", () => {
      this.stopAutoplay();
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this.init(), 100);
    });
  }
}

// =========================================================================
// КЛАСС ДЛЯ ВТОРОЙ (КРУГОВОЙ) КАРУСЕЛИ
// =========================================================================
class CircularCarousel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.items = Array.from(this.container.querySelectorAll(".circle-item"));
    this.radius = 210; // Радиус орбиты
    this.currentRotationAngle = 0;

    this.init();
  }

  init() {
    this.items.forEach((item, index) => {
      // Жестко фиксируем базовые углы элементов "крестом"
      // 0-й = 270° (Верх), 1-й = 0° (Право), 2-й = 90° (Низ), 3-й = 180° (Лево)
      const customAngles = [270, 0, 90, 180];
      const baseAngle = customAngles[index];
      item.dataset.baseAngle = baseAngle;

      // Навешиваем клик
      item.addEventListener("click", () => {
        // Чтобы элемент встал наверх (в 270°), колесо карусели должно повернуться на угол: 270 - baseAngle
        const targetRotation = 270 - baseAngle;

        // Считаем кратчайшую траекторию поворота (влево или вправо)
        let angleDiff = (targetRotation - this.currentRotationAngle) % 360;
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;

        this.currentRotationAngle += angleDiff;
        this.animateCarousel();
      });
    });

    // Первичная расстановка элементов на колесе (делается один раз при старте)
    this.items.forEach((item) => {
      const baseAngle = parseFloat(item.dataset.baseAngle);
      // Сдвигаем элемент вперед на значение радиуса по его оси, предварительно повернув на нужный угол
      item.style.transform = `rotate(${baseAngle}deg) translate(${this.radius}px) rotate(${-baseAngle}deg) scale(0.75)`;
    });

    // Стартовая позиция карусели
    this.currentRotationAngle = 0;
    this.animateCarousel();
  }

  animateCarousel() {
    // 1. Поворачиваем ВСЁ колесо карусели целиком. Кнопка клика заставит его крутиться по идеальной дуге!
    this.container.style.transform = `rotate(${this.currentRotationAngle}deg)`;

    // 2. Внутри колеса корректируем каждый элемент индивидуально (меняем масштаб, GIF и контр-поворот)
    this.items.forEach((item) => {
      const baseAngle = parseFloat(item.dataset.baseAngle);

      // Вычисляем, в какой точке экрана физически оказался элемент после поворота колеса
      let finalAngleDegrees = (baseAngle + this.currentRotationAngle) % 360;
      if (finalAngleDegrees < 0) finalAngleDegrees += 360;

      const img = item.querySelector("img");
      const gifUrl = item.dataset.gif;
      const jpgUrl = item.dataset.jpg;

      // Проверяем верхнюю точку (270 градусов)
      const isTopPosition = Math.abs(finalAngleDegrees - 270) < 1;
      const currentScale = isTopPosition ? 1 : 0.75;

      // Применяем трансформацию:
      // rotate(baseAngle) - возвращает элемент на его место на круге
      // translate(radius) - удерживает на орбите
      // rotate(${-baseAngle - currentRotationAngle}) - КОНТР-ВРАЩЕНИЕ. Выравнивает картинку строго горизонтально, чтобы она не переворачивалась боком при вращении колеса.
      item.style.transform = `rotate(${baseAngle}deg) translate(${this.radius}px) rotate(${-baseAngle - this.currentRotationAngle}deg) scale(${currentScale})`;

      if (isTopPosition) {
        item.classList.add("active");
        if (img && img.getAttribute("src") !== gifUrl) {
          img.setAttribute("src", gifUrl);
        }
      } else {
        item.classList.remove("active");
        if (img && img.getAttribute("src") !== jpgUrl) {
          img.setAttribute("src", jpgUrl);
        }
      }
    });
  }
}

// =========================================================================
// ЗАПУСК КАРУСЕЛЕЙ НА СТРАНИЦЕ
// =========================================================================
window.addEventListener("DOMContentLoaded", () => {
  const linear = new LinearCarousel("carousel-linear");
  const circular = new CircularCarousel("carousel-circular");
});
