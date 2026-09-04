/**
 * 사이트 전체를 비추는 "움직이는 조명" 상태.
 * 한 개의 루프가 천천히 도는 조명 위치(화면 비율 0..1)와 각도를 계산하고,
 * 배경 레이어(ambient-light.tsx)와 3D 잔(whisky-glass-3d.tsx)이 같은 값을 구독해요.
 * 마우스 위치를 살짝 따라가서 살아 있는 느낌을 줘요.
 */
export interface LightState {
  x: number; // 0..1 (viewport width 비율)
  y: number; // 0..1 (viewport height 비율)
  angle: number; // 라디안, 계속 증가
  t: number; // 초
}

type Listener = (s: LightState) => void;

const listeners = new Set<Listener>();
const state: LightState = { x: 0.62, y: 0.3, angle: 0, t: 0 };
let pointer: { x: number; y: number } | null = null;
let raf = 0;
let t0 = 0;
let reduced = false;

function onPointerMove(e: PointerEvent) {
  pointer = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
}

function loop(now: number) {
  const t = (now - t0) / 1000;
  state.t = t;
  state.angle = reduced ? 0.6 : t * 0.32;
  // 천천히 떠도는 기본 경로 (리사주)
  const bx = 0.55 + Math.sin(t * 0.11) * 0.3;
  const by = 0.32 + Math.cos(t * 0.087) * 0.2;
  const tx = pointer ? bx * 0.7 + pointer.x * 0.3 : bx;
  const ty = pointer ? by * 0.7 + pointer.y * 0.3 : by;
  state.x += (tx - state.x) * 0.02;
  state.y += (ty - state.y) * 0.02;
  for (const fn of listeners) fn(state);
  raf = requestAnimationFrame(loop);
}

export function subscribeLight(fn: Listener): () => void {
  listeners.add(fn);
  if (listeners.size === 1 && typeof window !== "undefined") {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    t0 = performance.now();
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    raf = requestAnimationFrame(loop);
  }
  fn(state);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && typeof window !== "undefined") {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
    }
  };
}

export function getLight(): LightState {
  return state;
}
