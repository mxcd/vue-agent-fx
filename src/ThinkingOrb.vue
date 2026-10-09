<!--
  Vue port of the thinking-orbs ThinkingOrb component. One shared clock
  (performance.now) keeps every orb in phase; each instance pauses while
  offscreen (IntersectionObserver) or on hidden tabs. Reduced-motion users
  get a static frame that still follows the live theme.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { MODE_DRAWS } from './engine/registry';
import { resolvePreset } from './presets';
import type { OrbState, ThinkingOrbProps } from './types';

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
  paused: false
});

const canvas = ref<HTMLCanvasElement | null>(null);
const autoDark = ref(true); // pre-mount / SSR fallback
const reduced = ref(false);
const dark = computed(() => (props.theme === 'auto' ? autoDark.value : props.theme === 'dark'));

function ancestorTheme(el: Element | null): boolean | null {
  for (let node = el; node; node = node.parentElement) {
    const attr = node.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    if (node.classList.contains('dark')) return true;
    if (node.classList.contains('light')) return false;
  }
  return null;
}

let cleanupTheme = () => {};
onMounted(() => {
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const motionMq = matchMedia('(prefers-reduced-motion: reduce)');
  const resolve = () => {
    autoDark.value = ancestorTheme(canvas.value) ?? darkMq.matches;
  };
  const onMotion = () => {
    reduced.value = motionMq.matches;
  };
  resolve();
  onMotion();
  darkMq.addEventListener('change', resolve);
  motionMq.addEventListener('change', onMotion);
  // live app-level toggles: class/data-theme flips anywhere in the tree
  const mo = new MutationObserver(resolve);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
    subtree: true
  });
  cleanupTheme = () => {
    darkMq.removeEventListener('change', resolve);
    motionMq.removeEventListener('change', onMotion);
    mo.disconnect();
  };
});
onBeforeUnmount(() => cleanupTheme());

watchEffect(
  (onCleanup) => {
    const el = canvas.value;
    if (!el) return;
    const { state, size, speed, paused } = props;
    const isDark = dark.value;

    const dpr = Math.min(2, devicePixelRatio || 1);
    el.width = Math.round(size * dpr);
    el.height = Math.round(size * dpr);
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const { mode, speed: baseSpeed, opts } = resolvePreset(state, size);
    const draw = MODE_DRAWS[mode];
    const effSpeed = baseSpeed * speed;

    const frame = (tSec: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      draw(ctx, size, tSec, isDark, opts);
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
