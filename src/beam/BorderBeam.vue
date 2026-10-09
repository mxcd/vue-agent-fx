<!--
  Vue port of the border-beam BorderBeam component. Wraps the default slot in
  a div driven by a per-instance generated stylesheet; the border radius is
  read from the first child unless given. Animations pause while offscreen
  (IntersectionObserver); the pulse sizes breathe via the shared rAF driver,
  skipped for reduced-motion users (the CSS drops its animations too).
  The sheet renders via <component is="style"> since SFC templates strip a
  literal <style>.
-->
<script setup lang="ts">
import { useAutoDark } from '../shared/autoDark';
import { computed, onBeforeUnmount, onMounted, ref, useId, watch, watchEffect } from 'vue';
import { registerPulseInstance } from './pulseDriver';
import { generateBeamCSS, getPulseDriverConfig, sizePresets, sizeThemePresets } from './styles';
import type { BorderBeamProps } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<BorderBeamProps>(), {
  size: 'md',
  colorVariant: 'colorful',
  theme: 'dark',
  staticColors: false,
  active: true,
  hueRange: 30,
  glowSize: 1,
  strength: 1
});

const emit = defineEmits<{ activate: []; deactivate: [] }>();

const id = `beam-${useId()}`;
const root = ref<HTMLDivElement | null>(null);
defineExpose({ el: root });

const isActive = ref(props.active);
const isFading = ref(false);
const isVisible = ref(true);
const detectedRadius = ref<number | null>(null);
const glowX = ref(1);
const glowY = ref(1);
const autoDark = useAutoDark(() => root.value);

let cleanupMounted = () => {};
onMounted(() => {
  // Pause the (paint-heavy) animations while scrolled offscreen, without
  // touching active/fading, so it never emits activate/deactivate.
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) isVisible.value = entry.isIntersecting;
    },
    // start animating slightly before the element scrolls into view
    { rootMargin: '256px' }
  );
  io.observe(root.value!);

  cleanupMounted = () => {
    io.disconnect();
  };
});
onBeforeUnmount(() => cleanupMounted());

// Auto-detect the child's border radius when no explicit value is given;
// re-detect when the slotted child is swapped.
watch(
  [() => props.borderRadius, root],
  ([radius, el], _old, onCleanup) => {
    if (radius != null || !el) return;
    const detect = () => {
      const child = el.firstElementChild as HTMLElement | null;
      if (!child) return;
      const raw = parseFloat(getComputedStyle(child).borderTopLeftRadius);
      if (!isNaN(raw) && raw > 0) detectedRadius.value = raw;
    };
    detect();
    const mo = new MutationObserver(detect);
    mo.observe(el, { childList: true, subtree: false });
    onCleanup(() => mo.disconnect());
  },
  { immediate: true, flush: 'post' }
);

watchEffect(() => {
  if (props.active && !isActive.value && !isFading.value) isActive.value = true;
  else if (!props.active && isActive.value && !isFading.value) isFading.value = true;
});

// Pulse Outside glow geometry is authored for a ~350x140 reference element;
// scale it per axis so the halo fits whatever it wraps.
watch(
  [() => props.size, root],
  ([size, el], _old, onCleanup) => {
    if (size !== 'pulse-outside' || !el) {
      glowX.value = 1;
      glowY.value = 1;
      return;
    }
    const clamp = (value: number) => Math.max(0.35, Math.min(4, value));
    const measure = () => {
      const child = el.firstElementChild as HTMLElement | null;
      if (!child) return;
      const rect = child.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      glowX.value = +clamp(rect.width / 350).toFixed(3);
      glowY.value = +clamp(rect.height / 140).toFixed(3);
    };
    measure();
    const child = el.firstElementChild;
    if (!child) return;
    const ro = new ResizeObserver(measure);
    ro.observe(child);
    onCleanup(() => ro.disconnect());
  },
  { immediate: true, flush: 'post' }
);

const resolved = computed(() => {
  const { size, theme, colorVariant, duration, saturation, brightness, hueRange, staticColors, borderRadius } = props;
  const resolvedTheme: 'dark' | 'light' = theme === 'auto' ? (autoDark.value ? 'dark' : 'light') : theme;
  const themeConfig = sizeThemePresets[size][resolvedTheme];
  const isPulse = size === 'pulse-inner' || size === 'pulse-outside';
  return {
    resolvedTheme,
    themeConfig,
    isPulse,
    borderRadius: borderRadius ?? detectedRadius.value ?? sizePresets[size].borderRadius,
    duration: duration ?? (size === 'line' ? 3.1 : isPulse ? 2.3 : 1.96),
    saturation: saturation ?? themeConfig.saturation,
    brightness: brightness ?? themeConfig.brightness ?? 1.3,
    hueRange: size === 'line' ? Math.min(hueRange, 13) : hueRange,
    staticColors: colorVariant === 'mono' ? true : staticColors
  };
});

const sheet = computed(() => {
  const r = resolved.value;
  const css = generateBeamCSS({
    id,
    borderRadius: r.borderRadius,
    borderWidth: sizePresets[props.size].borderWidth,
    duration: r.duration,
    strokeOpacity: r.themeConfig.strokeOpacity,
    innerOpacity: r.themeConfig.innerOpacity,
    bloomOpacity: r.themeConfig.bloomOpacity,
    innerShadow: r.themeConfig.innerShadow,
    size: props.size,
    colorVariant: props.colorVariant,
    staticColors: r.staticColors,
    brightness: r.brightness,
    saturation: r.saturation,
    hueRange: r.hueRange,
    theme: r.resolvedTheme,
    hairlineOpacity: r.themeConfig.hairlineOpacity,
    glowSize: props.glowSize
  });
  return props.css ? `${css}\n${props.css.split('{id}').join(id)}` : css;
});

// Runtime config for the JS breathing driver (null for non-pulse sizes).
const driverConfig = computed(() => {
  const r = resolved.value;
  return r.isPulse
    ? getPulseDriverConfig(props.size, r.resolvedTheme, r.duration, r.hueRange, r.staticColors, id)
    : null;
});

// Drive the pulse breathing from the shared rAF loop while the instance is
// on, onscreen, and the user hasn't requested reduced motion.
watch(
  [driverConfig, () => isActive.value || isFading.value, isVisible, root],
  ([config, on, visible, el], _old, onCleanup) => {
    if (!config || !on || !visible || !el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    onCleanup(registerPulseInstance(el, config));
  },
  { immediate: true, flush: 'post' }
);

const beamStyle = computed(() => ({
  '--beam-strength': Math.max(0, Math.min(1, props.strength)),
  ...(props.size === 'pulse-outside' ? { '--pulse-glow-sx': glowX.value, '--pulse-glow-sy': glowY.value } : {})
}));

function onAnimationEnd(e: AnimationEvent) {
  if (e.animationName.includes('fade-out')) {
    isActive.value = false;
    isFading.value = false;
    emit('deactivate');
  } else if (e.animationName.includes('fade-in')) {
    emit('activate');
  }
}
</script>

<template>
  <component is="style">{{ sheet }}</component>
  <div
    v-bind="$attrs"
    ref="root"
    :data-beam="id"
    :data-active="isActive && !isFading ? '' : undefined"
    :data-fading="isFading ? '' : undefined"
    :data-paused="isActive && !isFading && !isVisible ? '' : undefined"
    :style="beamStyle"
    @animationend="onAnimationEnd"
  >
    <slot />
    <div data-beam-bloom />
  </div>
</template>
