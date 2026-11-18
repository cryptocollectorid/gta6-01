// Keyboard + mouse input. WASD/arrows move, mouse drag orbits the camera,
// click fires the pistol, E enters/exits a car, F punches, Space handbrakes,
// Shift runs, P pauses/saves, M mutes, Enter confirms menus.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_SAVE = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let downX = 0;
  let downY = 0;
  let dragX = 0;
  let dragY = 0;
  let wheelDelta = 0;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(codeOf(event));
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
    if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'KeyQ') actions |= ACTION_SAVE;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(codeOf(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    downX = event.clientX;
    downY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup', (event) => {
    mouseDown = false;
    // A press without much movement is a click (shoot); a drag orbits.
    if (Math.hypot(event.clientX - downX, event.clientY - downY) < 6) mouseClicked = true;
  });
  canvas.addEventListener('pointercancel', () => { mouseDown = false; });
  canvas.addEventListener('pointermove', (event) => {
    if (!mouseDown) return;
    dragX += event.movementX;
    dragY += event.movementY;
  });
  canvas.addEventListener('wheel', (event) => {
    wheelDelta += event.deltaY;
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function axis(negative, positive) {
    const n = keys.has(negative) ? 1 : 0;
    const p = keys.has(positive) ? 1 : 0;
    return p - n;
  }

  return {
    // -1..1 forward (W / ArrowUp) and strafe (D / ArrowRight).
    move() {
      return {
        forward: axis('KeyS', 'KeyW') + axis('ArrowDown', 'ArrowUp'),
        strafe: axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight'),
      };
    },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    handbrake() { return keys.has('Space'); },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    takeDrag() {
      const d = { x: dragX, y: dragY };
      dragX = 0;
      dragY = 0;
      return d;
    },
    takeWheel() {
      const w = wheelDelta;
      wheelDelta = 0;
      return w;
    },
    anyKey() { return keys.size > 0; },
  };
}
