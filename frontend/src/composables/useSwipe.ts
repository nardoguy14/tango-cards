// Swiping a flashcard: right = got it, left = again. The card follows the finger, a stamp fades
// in, and past a threshold (or a quick flick) it flies off; otherwise it springs back.
//
// Touch events drive phones (iOS Safari cancels pointer events once it starts a scroll or a
// back-swipe); pointer events drive the mouse and pens. Styles are set on the element directly,
// since a drag updates every frame.
import { onMounted, onUnmounted, type Ref } from "vue";

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useSwipe(el: Ref<HTMLElement | undefined>, onThrown: (ok: boolean) => void) {
  let start: { x: number; y: number; t: number } | null = null;
  let dx = 0, dragging = false, throwing = false;
  /** True just after a drag, so the click it ends with doesn't also flip the card. */
  let swiped = false;

  const stamp = (cls: string) => el.value!.querySelector<HTMLElement>(`.stamp.${cls}`)!;
  function setDrag(x: number) {
    const e = el.value!;
    e.style.transform = `translateX(${x}px) rotate(${x / 18}deg)`;
    const k = Math.min(1, Math.abs(x) / 90);
    stamp("good").style.opacity = String(x > 0 ? k : 0);
    stamp("again").style.opacity = String(x < 0 ? k : 0);
  }

  /** Throw the card off screen, then report the answer. */
  function throwCard(ok: boolean) {
    const e = el.value;
    if (!e || throwing) return;
    if (reduceMotion()) return onThrown(ok);
    throwing = true;
    const dist = (ok ? 1 : -1) * (innerWidth + e.offsetWidth);
    e.classList.remove("back");
    stamp(ok ? "good" : "again").style.opacity = "1";
    e.classList.add("fly");
    e.style.transform = `translateX(${dist}px) rotate(${dist / 30}deg)`;
    let done = false;
    const finish = () => { if (done) return; done = true; throwing = false; onThrown(ok); };
    e.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 400); // in case transitionend doesn't fire
  }

  const down = (x: number, y: number) => {
    if (throwing) return;
    start = { x, y, t: performance.now() };
    dx = 0; dragging = false; swiped = false;
    el.value!.classList.remove("back");
  };
  // returns true once this gesture is a horizontal drag we own
  const move = (x: number, y: number) => {
    if (!start) return false;
    const mx = x - start.x, my = y - start.y;
    if (!dragging) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return false;
      if (Math.abs(my) > Math.abs(mx)) { start = null; return false; } // vertical: not ours
      dragging = true; swiped = true;
    }
    dx = mx; setDrag(dx);
    return true;
  };
  const up = () => {
    if (!start) return;
    const speed = Math.abs(dx) / Math.max(1, performance.now() - start.t); // px per ms
    start = null;
    if (!dragging) return;
    if (Math.abs(dx) > Math.min(110, el.value!.offsetWidth * 0.3) || (speed > 0.6 && Math.abs(dx) > 30)) throwCard(dx > 0);
    else { el.value!.classList.add("back"); setDrag(0); }
    setTimeout(() => { swiped = false; }, 50);
  };

  const onTouchStart = (e: TouchEvent) => { if (e.touches.length !== 1) { start = null; return; } down(e.touches[0].clientX, e.touches[0].clientY); };
  const onTouchMove = (e: TouchEvent) => { if (e.touches.length === 1 && move(e.touches[0].clientX, e.touches[0].clientY)) e.preventDefault(); };
  const onPointerDown = (e: PointerEvent) => { if (e.pointerType !== "touch" && e.button === 0) down(e.clientX, e.clientY); };
  const onPointerMove = (e: PointerEvent) => { if (e.pointerType !== "touch" && move(e.clientX, e.clientY)) el.value?.setPointerCapture?.(e.pointerId); };
  const onPointerUp = (e: PointerEvent) => { if (e.pointerType !== "touch") up(); };

  onMounted(() => {
    const e = el.value!;
    e.addEventListener("touchstart", onTouchStart, { passive: true });
    e.addEventListener("touchmove", onTouchMove, { passive: false });
    e.addEventListener("touchend", up);
    e.addEventListener("touchcancel", up);
    e.addEventListener("pointerdown", onPointerDown);
    e.addEventListener("pointermove", onPointerMove);
    e.addEventListener("pointerup", onPointerUp);
    e.addEventListener("pointercancel", onPointerUp);
  });
  onUnmounted(() => { start = null; });

  return { throwCard, wasSwiped: () => swiped };
}
