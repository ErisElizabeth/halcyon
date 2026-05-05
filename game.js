const gameplay = document.querySelector("#gameplay");
const cursor = document.querySelector(".cursor");

const cursorState = {
  x: 0,
  y: 0,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function playableBounds() {
  const rect = gameplay.getBoundingClientRect();
  const styles = getComputedStyle(gameplay);
  const left = Number.parseFloat(styles.borderLeftWidth);
  const top = Number.parseFloat(styles.borderTopWidth);
  const radius = cursor.offsetWidth / 2;

  return {
    minX: radius,
    minY: radius,
    maxX: gameplay.clientWidth - radius,
    maxY: gameplay.clientHeight - radius,
    offsetX: left,
    offsetY: top,
    rect,
  };
}

function moveCursor(x, y) {
  const bounds = playableBounds();
  cursorState.x = clamp(x, bounds.minX, bounds.maxX);
  cursorState.y = clamp(y, bounds.minY, bounds.maxY);
  cursor.style.transform = `translate(${cursorState.x}px, ${cursorState.y}px)`;
}

function centerCursor() {
  const bounds = playableBounds();
  moveCursor((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
}

gameplay.addEventListener("pointermove", (event) => {
  if (document.pointerLockElement === gameplay) {
    moveCursor(cursorState.x + event.movementX, cursorState.y + event.movementY);
    return;
  }

  const bounds = playableBounds();
  moveCursor(
    event.clientX - bounds.rect.left - bounds.offsetX,
    event.clientY - bounds.rect.top - bounds.offsetY,
  );
});

gameplay.addEventListener("click", () => {
  gameplay.requestPointerLock?.();
  gameplay.classList.add("active");
  centerCursor();
});

document.addEventListener("pointerlockchange", () => {
  gameplay.classList.toggle("active", document.pointerLockElement === gameplay);
});

window.addEventListener("resize", centerCursor);
centerCursor();
