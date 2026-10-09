<!--
  Vue port of the thinking-orbs ThinkingOrb component. One shared clock
  (performance.now) keeps every orb in phase; each instance pauses while
  offscreen (IntersectionObserver) or on hidden tabs. Reduced-motion users
  get a static frame that still follows the live theme.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';
import { type OrbTint, paintFrame } from './engine/core';
import { scaleCounts, scaleRadii } from './engine/profiles';
import { MODE_FRAMES } from './engine/registry';
import { useAutoDark } from '../shared/autoDark';
import { attachGravity } from './gravity';
import { resolvePreset } from './presets';
import type { OrbState, ThinkingOrbProps } from './types';

/** #rgb, #rrggbb or rgb()/rgba() → RGB triple; anything else → no tint. */
function parseTint(color: string | undefined): OrbTint | undefined {
  if (!color) return undefined;
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.replace(/./g, (c) => c + c);
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const fn = color.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (fn) return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]) };
  return undefined;
}

const LABELS: Record<OrbState, string> = {
  working: 'Working…',
  searching: 'Searching…',
  solving: 'Solving…',
  listening: 'Listening…',
  connecting: 'Connecting…',
  weaving: 'Weaving…',
  composing: 'Composing…',
  breathing: 'Thinking…',
  shaping: 'Shaping…'
};

const props = withDefaults(defineProps<ThinkingOrbProps>(), {
  state: 'working',
  size: 64,
  theme: 'auto',
  speed: 1,
  paused: false,
  dots: 1,
  dotSize: 1,
  gravity: false
});

const canvas = ref<HTMLCanvasElement | null>(null);
const autoDark = useAutoDark(() => canvas.value);
const reduced = ref(false);
const dark = computed(() => (props.theme === 'auto' ? autoDark.value : props.theme === 'dark'));

let cleanupMotion = () => {};
onMounted(() => {
  const motionMq = matchMedia('(prefers-reduced-motion: reduce)');
  const onMotion = () => {
    reduced.value = motionMq.matches;
  };
  onMotion();
  motionMq.addEventListener('change', onMotion);
  cleanupMotion = () => motionMq.removeEventListener('change', onMotion);
});
onBeforeUnmount(() => cleanupMotion());

// gravity attaches the canvas to the document-level tracker; compared by
// content so an inline options literal does not re-attach every render
watch(
  [canvas, () => (props.gravity ? JSON.stringify(props.gravity) : '')],
  ([el], _old, onCleanup) => {
    const g = props.gravity;
    if (el && g) onCleanup(attachGravity(el, g));
  },
  { flush: 'post' }
);

watchEffect(
  (onCleanup) => {
    const el = canvas.value;
    if (!el) return;
    const { state, size, speed, paused, color, dots, dotSize, opts: optsOverride, frame: customFrame } = props;
    const isDark = dark.value;

    const dpr = Math.min(2, devicePixelRatio || 1);
    el.width = Math.round(size * dpr);
    el.height = Math.round(size * dpr);
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const { mode, speed: baseSpeed, opts: presetOpts } = resolvePreset(state, size);
    // resolvePreset caches — never mutate its result
    let opts = dots !== 1 ? scaleCounts(presetOpts, Math.max(0.1, dots)) : presetOpts;
    if (dotSize !== 1) opts = scaleRadii(opts, Math.max(0.1, dotSize));
    if (optsOverride) opts = { ...opts, ...optsOverride };
    const frameFn = customFrame ?? MODE_FRAMES[mode];
    const tint = parseTint(color);
    const effSpeed = baseSpeed * speed;

    const frame = (tSec: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      paintFrame(ctx, frameFn(size, tSec, opts), isDark, tint);
    };

    // reduced motion → one static, deterministic frame
    if (reduced.value) {
      frame(0.6);
      return;
    }

    let raf = 0;
    let running = false;
    const loop = () => {
      frame((performance.now() / 1000) * effSpeed);
      if (running) raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || paused) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // draw at least one frame even when paused/offscreen
    frame((performance.now() / 1000) * effSpeed);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && document.visibilityState !== 'hidden') start();
      else stop();
    });
    io.observe(el);
    const onVis = () => {
      if (document.visibilityState === 'hidden') stop();
      else if (visible) start();
    };
    document.addEventListener('visibilitychange', onVis);

    onCleanup(() => {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    });
  },
  { flush: 'post' }
);
</script>

<template>
  <canvas
    ref="canvas"
    role="img"
    :aria-label="ariaLabel ?? LABELS[state]"
    :style="{ width: `${size}px`, height: `${size}px`, display: 'block' }"
  />
</template>
