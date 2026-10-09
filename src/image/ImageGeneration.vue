<!--
  Vue port of img-fx's ImageGeneration. Wraps a single host element; a shared
  WebGL renderer paints the "generating" mosaic over it and the reveal
  pipeline dissolves images from the pool in on top. The instance, reveal and
  cycle live for the component's lifetime (created on mount, disposed on
  unmount, the last instance on the page frees the shared GL context); every
  prop is synced onto them live.
-->
<script setup lang="ts">
import { useAutoDark } from '../shared/autoDark';
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, shallowRef, watch, watchEffect } from 'vue';
import {
  createCycle,
  createInstance,
  createReveal,
  destroyInstance,
  renderInstanceOnce,
  samplePaletteFromCanvas,
  setInstanceCardBg,
  setInstanceColors,
  setInstancePaused,
  setInstancePixelScale,
  setInstancePreset,
  setInstanceSpeed,
  setInstanceStrength,
  setInstanceVisible,
  setSharedFragmentShader,
  updateInstanceSize,
  type Cycle,
  type Instance,
  type SampledPalette
} from './engine';
import { PRESETS } from './presets';
import { ensureStylesInjected } from './styles';
import type { ImageGenerationCycleEvent, ImageGenerationHandle, ImageGenerationPreset, ImageGenerationProps } from './types';

/** The regenerate churn always runs on one of these pixel-mosaic presets. */
const PIXEL_CHURN_PRESETS: ImageGenerationPreset[] = ['pixels-mechanic', 'pixels-organic'];

const props = withDefaults(defineProps<ImageGenerationProps>(), {
  preset: 'pixels-organic',
  theme: 'auto',
  strength: 1,
  speed: 1,
  pixelScale: 1,
  images: () => [],
  autoReveal: false,
  revealDelayRange: () => [2, 4],
  revealHoldMs: 2000,
  revealFadeOutMs: 300,
  paused: false
});
const emit = defineEmits<{ cycle: [event: ImageGenerationCycleEvent] }>();

ensureStylesInjected();

const root = ref<HTMLDivElement | null>(null);
const shaderCanvas = ref<HTMLCanvasElement | null>(null);
const overlayCanvas = ref<HTMLCanvasElement | null>(null);
const content = ref<HTMLDivElement | null>(null);
const inst = shallowRef<Instance | null>(null);
const cycle = shallowRef<Cycle | null>(null);

// Transient overrides for the regenerate churn: an image-sampled palette +
// card surface, and a pixel preset swapped in when the authored one is not a
// pixel mosaic. Both clear when the next image reaches `visible`.
const regenTint = shallowRef<SampledPalette | null>(null);
const regenPresetName = ref<ImageGenerationPreset | null>(null);

const autoDark = useAutoDark(() => root.value?.parentElement);
const resolvedTheme = computed(() => (props.theme === 'auto' ? (autoDark.value ? 'dark' : 'light') : props.theme));
const presetMode = computed(() => PRESETS[props.preset].modes[resolvedTheme.value]);
const imagesArr = computed(() => (typeof props.images === 'string' ? [props.images] : props.images.slice()));

let cleanup = () => {};
onMounted(() => {
  const rootEl = root.value!;
  const shader = shaderCanvas.value!;
  const overlay = overlayCanvas.value!;

  // Size from the root box; radius from the wrapped child (else the root).
  // The shader renders one uniform radius, so top-left stands for all four.
  const measure = () => {
    const rect = rootEl.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    let r = 0;
    if (typeof props.borderRadius === 'number') {
      r = props.borderRadius;
    } else {
      for (const el of [content.value?.firstElementChild, rootEl]) {
        if (!el) continue;
        const parsed = parseFloat(getComputedStyle(el).borderTopLeftRadius);
        if (Number.isFinite(parsed) && parsed > 0) {
          r = parsed;
          break;
        }
      }
    }
    return { w, h, r };
  };
  const applyRadius = (r: number) => {
    rootEl.style.setProperty('--image-gen-radius', `${r}px`);
    rootEl.style.borderRadius = `${r}px`;
  };

  let last = measure();
  const i = createInstance({
    canvas: shader,
    cssWidth: last.w,
    cssHeight: last.h,
    preset: presetMode.value,
    strength: props.strength,
    speed: props.speed,
    cardBg: props.cardBg ?? null,
    pixelScale: props.pixelScale
  });
  const reveal = createReveal({ canvas: overlay, cssWidth: last.w, cssHeight: last.h, shaderCanvas: shader });
  i.reveal = reveal;

  // Range tuples randomise once here, never on prop updates.
  const d = props.revealInitialDelay;
  let initialDelayMs: number | undefined;
  if (typeof d === 'number') initialDelayMs = Math.max(0, d) * 1000;
  else if (d) {
    const lo = Math.max(0, Math.min(...d));
    const hi = Math.max(0, ...d);
    initialDelayMs = (lo + Math.random() * (hi - lo)) * 1000;
  }

  // created regardless of autoReveal so manual triggerReveal() works too
  const c = createCycle({
    reveal,
    images: imagesArr.value,
    delayRange: props.revealDelayRange,
    holdMs: props.revealHoldMs,
    fadeOutMs: props.revealFadeOutMs,
    initialDelayMs,
    onPhase: (e) => {
      // a fully visible image ends any regenerate churn
      if (e.phase === 'visible') {
        regenTint.value = null;
        regenPresetName.value = null;
      }
      emit('cycle', e);
    },
    excludeSrcs: () => props.excludeSrcs?.() ?? null
  });
  applyRadius(last.r);

  // Follow the host card: root/child resizes plus class/style flips on the
  // child that move its radius, coalesced into one measure per frame.
  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const next = measure();
      if (next.w !== last.w || next.h !== last.h) updateInstanceSize(i, next.w, next.h);
      if (next.r !== last.r) applyRadius(next.r);
      last = next;
    });
  };
  const ro = new ResizeObserver(schedule);
  ro.observe(rootEl);
  const child = content.value?.firstElementChild;
  const childMo = new MutationObserver(schedule);
  if (child) {
    ro.observe(child);
    childMo.observe(child, { attributes: true, attributeFilter: ['class', 'style'] });
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) setInstanceVisible(i, e.isIntersecting);
    },
    { rootMargin: '64px' }
  );
  io.observe(rootEl);

  inst.value = i;
  cycle.value = c;
  cleanup = () => {
    ro.disconnect();
    childMo.disconnect();
    io.disconnect();
    cancelAnimationFrame(raf);
  };
});
onBeforeUnmount(() => cleanup());
// after the watchers below have stopped (autoReveal's cleanup calls stop())
onUnmounted(() => {
  cycle.value?.dispose();
  if (inst.value) destroyInstance(inst.value); // also disposes the reveal
});

// Live prop sync. Each repaints once where needed so a paused instance
// still reflects the change; regenerate overrides win over the props.
watch([inst, presetMode, regenPresetName, resolvedTheme], ([i, mode, regen, theme]) => {
  if (!i) return;
  setInstancePreset(i, regen ? PRESETS[regen].modes[theme] : mode);
  renderInstanceOnce(i);
});
watch([inst, () => props.cardBg, regenTint], ([i, bg, tint]) => {
  if (!i) return;
  setInstanceCardBg(i, tint?.cardBg ?? bg ?? null);
  renderInstanceOnce(i);
});
watch([inst, () => props.colors, regenTint], ([i, colors, tint]) => {
  if (!i) return;
  setInstanceColors(i, tint?.colors ?? colors ?? null);
  renderInstanceOnce(i);
});
watch([inst, () => props.strength], ([i, strength]) => {
  if (!i) return;
  setInstanceStrength(i, strength);
  i.canvas.style.opacity = String(Math.max(0, Math.min(1, strength)));
});
watch([inst, () => props.speed], ([i, speed]) => {
  if (i) setInstanceSpeed(i, speed);
});
watch([inst, () => props.pixelScale], ([i, scale]) => {
  if (!i) return;
  setInstancePixelScale(i, scale);
  renderInstanceOnce(i);
});
watch([inst, cycle, () => props.paused], ([i, c, paused]) => {
  if (i) setInstancePaused(i, paused);
  c?.setPaused(paused);
});
// custom fragment stage: page-wide while set, bundled one restored after
watchEffect((onCleanup) => {
  const src = props.fragmentShader;
  if (!src) return;
  setSharedFragmentShader(src);
  onCleanup(() => setSharedFragmentShader(null));
});
watch([cycle, imagesArr], ([c, images]) => c?.setImages(images));
watch([cycle, () => props.revealDelayRange, () => props.revealHoldMs, () => props.revealFadeOutMs], ([c, delayRange, holdMs, fadeOutMs]) =>
  c?.setOptions({ delayRange, holdMs, fadeOutMs })
);
watch([cycle, () => props.autoReveal], ([c, auto], _old, onCleanup) => {
  if (!c) return;
  if (!auto) return c.stop();
  c.start();
  onCleanup(() => c.stop());
});

defineExpose<ImageGenerationHandle>({
  get element() {
    return root.value;
  },
  triggerReveal(opts) {
    cycle.value?.triggerOnce(opts);
  },
  triggerHide() {
    cycle.value?.triggerHide();
  },
  triggerRegenerate(opts) {
    const c = cycle.value;
    if (!c || props.paused) return;
    const phase = c.getPhase();
    if (phase !== 'reveal' && phase !== 'visible') return;
    const churnName = PIXEL_CHURN_PRESETS.includes(props.preset)
      ? null
      : PIXEL_CHURN_PRESETS[Math.floor(Math.random() * PIXEL_CHURN_PRESETS.length)];
    // recolor from the visible image, mapped onto the churn preset's slots
    if ((opts?.tintFromImage ?? true) && overlayCanvas.value) {
      const churnColors = churnName ? PRESETS[churnName].modes[resolvedTheme.value].colors : presetMode.value.colors;
      const sampled = samplePaletteFromCanvas(overlayCanvas.value, churnColors);
      if (sampled) regenTint.value = sampled;
    }
    if (churnName) regenPresetName.value = churnName;
    c.triggerBoil((opts?.autoReveal ?? true) ? { autoRevealAfterMs: opts?.durationMs ?? 4000 } : undefined);
  },
  isImageActive() {
    const phase = cycle.value?.getPhase() ?? 'idle';
    return phase === 'reveal' || phase === 'visible' || phase === 'hide';
  }
});
</script>

<template>
  <div
    ref="root"
    class="image-gen-root"
    :data-preset="preset"
    :data-theme="resolvedTheme"
    :data-paused="paused ? 'true' : undefined"
    :style="{ background: regenTint?.cardBg ?? cardBg ?? presetMode.cardBg }"
  >
    <canvas ref="shaderCanvas" class="image-gen-shader" aria-hidden="true" />
    <canvas ref="overlayCanvas" class="image-gen-overlay" aria-hidden="true" />
    <div ref="content" class="image-gen-child"><slot /></div>
  </div>
</template>
