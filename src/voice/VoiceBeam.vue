<!--
  Vue port of the voice-glow VoiceBeam component: a sound-reactive glow
  along the bottom edge of the wrapped element (the default slot) that
  rises and blooms with the level of a voice. Feed it a microphone
  stream, or drive it yourself with `level`.

  <VoiceBeam :stream="mic.stream.value"><ChatInput /></VoiceBeam>

  The shared driver (voiceDriver.ts) runs every instance from one rAF
  loop; this component only resolves props into its config, generates the
  per-instance stylesheet and (re-)registers while active and on screen.
-->
<script setup lang="ts">
import { useAutoDark } from '../shared/autoDark';
import { computed, onBeforeUnmount, onMounted, ref, toRaw, useId, watch, watchEffect } from 'vue';
import type { VoiceBeamEmits, VoiceBeamProps } from './types';
import { themePresets, generateVoiceBeamCSS } from './styles';
import { registerVoiceInstance, type VoiceDriverConfig } from './voiceDriver';
import { resolveVoiceDefaults, resolveVoiceStyle } from './presets';
import { toTriple } from './color';
import { __VOICE_SURFACE__ } from './env';

/** Band colour defaults per theme, as `r, g, b` triples. */
const BAND_COLORS = {
  dark: { core: '255, 255, 255', above: '255, 70, 80', mid: '90, 255, 150', below: '80, 140, 255' },
  light: { core: '197, 139, 255', above: '255, 122, 182', mid: '126, 196, 255', below: '45, 255, 171' },
} as const;

const BORDER_WIDTH = 1;
const DEFAULT_RADIUS = 16;

/* WebKit (Safari) evaluates SVG filters on HTML content on the CPU every
   paint, which on a phone-sized host drops the frame rate by an order of
   magnitude, so the displacement warp is off there above this host area:
   a chat input (~39k px²) or a pill keeps it, the phone crop (~97k px²)
   and any real screen do not. Its 2D canvas also has no `filter`, so the
   band's blur is done in CSS on two canvases instead (the ridge and its
   wider halo), keeping Chromium's look. */
const WEBKIT_WARP_MAX_AREA = 60_000;
// Every iOS browser is WebKit whatever its name (CriOS, FxiOS); only
// desktop Blink carries "Chrome/".
const IS_WEBKIT =
  typeof navigator !== 'undefined' &&
  /AppleWebKit/.test(navigator.userAgent) &&
  !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(navigator.userAgent);
const CANVAS_FILTER = (() => {
  if (typeof document === 'undefined') return true;
  const ctx = document.createElement('canvas').getContext('2d');
  return !!ctx && typeof (ctx as { filter?: unknown }).filter === 'string';
})();

const props = withDefaults(defineProps<VoiceBeamProps>(), {
  type: 'default',
  look: 'glow',
  dotSize: 1,
  dotGap: 1,
  dotShape: 'round',
  lineWidth: 1,
  lineGap: 1,
  linePattern: 'rows',
  seeThrough: false,
  texture: 0.6,
  gravity: 1,
  surfaceHeight: 1,
  surfaceCurve: 1,
  surfaceTail: 0,
  surfaceTailPosition: 0.6,
  surfaceTailCurve: 2.4,
  surfaceFade: 0.2,
  stream: null,
  level: 0,
  sensitivity: 3.1,
  threshold: 0.015,
  attack: 0.325,
  release: 0.86,
  breatheDuration: 5.2,
  bands: true,
  motion: null,
  colorVariant: 'colorful',
  theme: 'dark',
  staticColors: false,
  active: true,
  paused: false,
});
const emit = defineEmits<VoiceBeamEmits>();

const id = useId();
const root = ref<HTMLDivElement | null>(null);
defineExpose({ el: root });

// --- environment: theme, reduced motion, visibility, host size ---------

const autoDark = useAutoDark(() => root.value);
const reducedMotion = ref(false);
const isVisible = ref(true);
/* The host's area, measured on WebKit only, to keep the warp off large hosts there. */
const hostArea = ref(0);
const resolvedTheme = computed<'dark' | 'light'>(() =>
  props.theme === 'auto' ? (autoDark.value ? 'dark' : 'light') : props.theme
);

let cleanupEnv = () => {};
onMounted(() => {
  const el = root.value!;
  const motionMq = matchMedia('(prefers-reduced-motion: reduce)');
  const onMotion = () => {
    reducedMotion.value = motionMq.matches;
  };
  onMotion();
  motionMq.addEventListener('change', onMotion);
  // Stop the per-frame work while the element is scrolled offscreen.
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) isVisible.value = entry.isIntersecting;
    },
    { rootMargin: '256px' }
  );
  io.observe(el);

  let ro: ResizeObserver | undefined;
  if (IS_WEBKIT) {
    const measure = () => (hostArea.value = el.clientWidth * el.clientHeight);
    measure();
    ro = new ResizeObserver(measure);
    ro.observe(el);
  }

  cleanupEnv = () => {
    motionMq.removeEventListener('change', onMotion);
    io.disconnect();
    ro?.disconnect();
  };
});
onBeforeUnmount(() => cleanupEnv());

// --- border radius: explicit, else the first child's -------------------

const detectedRadius = ref<number | null>(null);
watchEffect(
  (onCleanup) => {
    const el = root.value;
    if (props.borderRadius != null || !el) return;
    const detect = () => {
      const child = el.firstElementChild as HTMLElement | null;
      if (!child) return;
      const raw = parseFloat(getComputedStyle(child).borderTopLeftRadius);
      if (!isNaN(raw) && raw > 0) detectedRadius.value = raw;
    };
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(el, { childList: true, subtree: false });
    onCleanup(() => observer.disconnect());
  },
  { flush: 'post' }
);

// --- active / fading -----------------------------------------------------

const isActive = ref(props.active);
const isFading = ref(false);
watchEffect(() => {
  if (props.active && !isActive.value && !isFading.value) isActive.value = true;
  else if (!props.active && isActive.value && !isFading.value) isFading.value = true;
});

function onAnimationEnd(e: AnimationEvent) {
  if (e.animationName.includes('fade-out')) {
    isActive.value = false;
    isFading.value = false;
    emit('deactivate');
  } else if (e.animationName.includes('fade-in')) {
    emit('activate');
  }
}

// --- resolved props --------------------------------------------------------

// Dots and lines are one surface, painted on a canvas instead of the glow's layers.
// Not released yet: without the build switch every look is the glow.
const effLook = computed(() => (__VOICE_SURFACE__ ? props.look : 'glow'));
const isSurface = computed(() => __VOICE_SURFACE__ && (effLook.value === 'dots' || effLook.value === 'lines'));

// The type preset supplies the geometry defaults; an explicit prop
// wins; `scale` then multiplies every pixel dimension as one.
const r = computed(() => {
  const p = props;
  const theme = resolvedTheme.value;
  const d = resolveVoiceDefaults(p.type, theme);
  const sc = Math.max(0.05, p.scale ?? d.scale);
  const preset = themePresets[theme];
  const typeStyle = resolveVoiceStyle(p.type, theme);
  const distortionBase = p.distortion ?? d.distortion;
  return {
    sc,
    preset,
    glowSize: p.glowSize ?? d.glowSize,
    strokeOpacityMul: p.strokeOpacity ?? d.strokeOpacity,
    innerOpacityMul: p.innerOpacity ?? d.innerOpacity,
    bloomOpacityMul: p.bloomOpacity ?? d.bloomOpacity,
    idle: p.idle ?? d.idle,
    reach: p.reach ?? d.reach,
    spread: p.spread ?? d.spread,
    flow: (p.flow ?? d.flow) * sc,
    bend: (p.bend ?? d.bend) * sc,
    bandStrength: p.bandStrength ?? d.bandStrength,
    bandWidth: (p.bandWidth ?? d.bandWidth) * sc,
    bandPosition: p.bandPosition ?? d.bandPosition,
    bandCurve: p.bandCurve ?? d.bandCurve,
    bandSpread: p.bandSpread ?? d.bandSpread,
    bandSkew: p.bandSkew ?? d.bandSkew,
    bandOffset: (p.bandOffset ?? d.bandOffset) * sc,
    bandTail: p.bandTail ?? d.bandTail,
    bandTailPosition: p.bandTailPosition ?? d.bandTailPosition,
    bandTailCurve: p.bandTailCurve ?? d.bandTailCurve,
    bandTailOverflow: (p.bandTailOverflow ?? d.bandTailOverflow) * sc,
    bandAberration: p.bandAberration ?? d.bandAberration,
    // The WebKit gate is about the SVG warp's cost; the surface has no warp.
    distortion: !isSurface.value && IS_WEBKIT && hostArea.value > WEBKIT_WARP_MAX_AREA ? 0 : distortionBase,
    distortionDetail: (p.distortionDetail ?? d.distortionDetail) / sc,
    glowWidth: (p.glowWidth ?? d.glowWidth) * sc,
    glowHeight: (p.glowHeight ?? d.glowHeight) * sc,
    lobeSpacing: (p.lobeSpacing ?? d.lobeSpacing) * sc,
    rangeWidth: (p.rangeWidth ?? d.rangeWidth) * sc,
    rangeHeight: (p.rangeHeight ?? d.rangeHeight) * sc,
    softness: p.softness ?? d.softness,
    coreSize: (p.coreSize ?? d.coreSize) * sc,
    coreLight: Math.max(0, Math.min(3, p.coreLight ?? d.coreLight)),
    coreLightWidth: p.coreLightWidth ?? d.coreLightWidth,
    coreLightHeight: p.coreLightHeight ?? d.coreLightHeight,
    strokeScale: p.strokeScale ?? d.strokeScale,
    innerScale: p.innerScale ?? d.innerScale,
    innerHeight: p.innerHeight ?? d.innerHeight,
    bloomScale: p.bloomScale ?? d.bloomScale,
    bloomHeight: p.bloomHeight ?? d.bloomHeight,
    radius: p.borderRadius ?? detectedRadius.value ?? DEFAULT_RADIUS,
    strength: p.strength ?? typeStyle.strength ?? preset.strength ?? 1,
    hueRange: p.hueRange ?? preset.hueRange ?? 24,
    hueDuration: p.hueDuration ?? preset.hueDuration ?? 12,
    brightness: p.brightness ?? typeStyle.brightness ?? preset.brightness,
    saturation: p.saturation ?? typeStyle.saturation ?? preset.saturation,
  };
});

const cssStyles = computed(() => {
  const v = r.value;
  const css = generateVoiceBeamCSS({
    id,
    borderRadius: v.radius,
    borderWidth: BORDER_WIDTH,
    strokeOpacity: v.preset.strokeOpacity * v.strokeOpacityMul,
    innerOpacity: v.preset.innerOpacity * v.innerOpacityMul,
    bloomOpacity: v.preset.bloomOpacity * v.bloomOpacityMul,
    innerShadow: v.preset.innerShadow,
    colorVariant: props.colorVariant,
    colors: props.colors,
    brightness: v.brightness,
    saturation: v.saturation,
    theme: resolvedTheme.value,
    hueBase: v.preset.hueBase ?? 0,
    glowSize: v.glowSize * v.sc,
    glowWidth: v.glowWidth,
    glowHeight: v.glowHeight,
    strokeScale: v.strokeScale,
    innerScale: v.innerScale,
    innerHeight: v.innerHeight,
    bloomScale: v.bloomScale,
    bloomHeight: v.bloomHeight,
    coreSize: v.coreSize,
    coreLight: v.coreLight,
    coreLightWidth: v.coreLightWidth,
    coreLightHeight: v.coreLightHeight,
    rangeWidth: v.rangeWidth,
    rangeHeight: v.rangeHeight,
    softness: v.softness,
    distortion: v.distortion > 0,
    scale: v.sc,
    look: effLook.value,
  });
  return props.css ? `${css}\n${props.css.split('{id}').join(id)}` : css;
});

// Runtime config for the shared driver. Numbers only, so it is compared
// by value below: a re-render with the same knobs does not re-register.
const driverConfig = computed<VoiceDriverConfig>(() => {
  const p = props;
  const v = r.value;
  const theme = resolvedTheme.value;
  const bc = p.bandColors;
  return {
    id,
    sensitivity: Math.max(0, p.sensitivity),
    threshold: Math.max(0, Math.min(0.95, p.threshold)),
    attack: Math.max(0, p.attack),
    release: Math.max(0, p.release),
    idle: Math.max(0, Math.min(1, v.idle)),
    breatheDuration: Math.max(0.2, p.breatheDuration),
    reach: Math.max(0, v.reach),
    spread: Math.max(0, v.spread),
    bands: p.bands,
    flow: v.flow,
    lobeSpacing: Math.max(0.1, v.lobeSpacing),
    bend: Math.max(0, v.bend),
    bandStrength: Math.max(0, v.bandStrength),
    bandWidth: Math.max(0, v.bandWidth),
    bandPosition: Math.max(0, v.bandPosition),
    bandCurve: Math.max(0.3, v.bandCurve),
    bandSpread: Math.max(0.05, v.bandSpread),
    bandSkew: Math.max(-0.9, Math.min(0.9, v.bandSkew)),
    bandOffset: v.bandOffset,
    bandTail: Math.max(0, Math.min(1.5, v.bandTail)),
    bandTailPosition: Math.max(0, Math.min(0.98, v.bandTailPosition)),
    bandTailCurve: Math.max(0.5, v.bandTailCurve),
    bandTailOverflow: Math.max(0, v.bandTailOverflow),
    bandAberration: Math.max(0, Math.min(1, v.bandAberration)),
    rangeWidth: v.rangeWidth,
    rangeHeight: v.rangeHeight,
    theme,
    bandColors: {
      core: (bc?.core && toTriple(bc.core)) || BAND_COLORS[theme].core,
      above: (bc?.above && toTriple(bc.above)) || BAND_COLORS[theme].above,
      mid: (bc?.mid && toTriple(bc.mid)) || BAND_COLORS[theme].mid,
      below: (bc?.below && toTriple(bc.below)) || BAND_COLORS[theme].below,
    },
    distortion: Math.max(0, Math.min(1, v.distortion)),
    coreLight: v.coreLight,
    scale: v.sc,
    radius: v.radius,
    hueRange: Math.max(0, v.hueRange),
    hueDuration: Math.max(0.5, v.hueDuration),
    staticColors: p.colorVariant === 'mono' ? true : p.staticColors,
    reducedMotion: reducedMotion.value,
    paused: p.paused,
    look: effLook.value,
    dotSize: Math.max(0.1, p.dotSize),
    dotGap: Math.max(0.3, p.dotGap),
    dotShape: p.dotShape === 'square' ? 'square' : 'round',
    lineWidth: Math.max(0.05, p.lineWidth),
    lineGap: Math.max(0.3, p.lineGap),
    linePattern: p.linePattern === 'columns' || p.linePattern === 'grid' ? p.linePattern : 'rows',
    seeThrough: p.seeThrough,
    texture: Math.max(0, Math.min(1, p.texture)),
    gravity: Math.max(0.05, p.gravity),
    surfaceHeight: Math.max(0.1, p.surfaceHeight),
    surfaceCurve: Math.max(-3, Math.min(5, p.surfaceCurve)),
    surfaceTail: Math.max(-2, Math.min(3, p.surfaceTail)),
    surfaceTailPosition: Math.max(0, Math.min(0.98, p.surfaceTailPosition)),
    surfaceTailCurve: Math.max(0.5, p.surfaceTailCurve),
    surfaceFade: Math.max(0, Math.min(1, p.surfaceFade)),
    layers: {
      glowWidth: v.glowWidth,
      glowHeight: v.glowHeight,
      innerScale: v.innerScale,
      innerHeight: v.innerHeight,
      bloomScale: v.bloomScale,
      bloomHeight: v.bloomHeight,
      strokeScale: v.strokeScale,
      softness: v.softness,
      coreSize: v.coreSize,
      innerOpacity: v.innerOpacityMul,
      bloomOpacity: v.bloomOpacityMul,
      strokeOpacity: v.strokeOpacityMul,
      brightness: v.brightness,
    },
  };
});

// The level and motion getters read the props live each frame, so a
// changing value does not tear the driver down and up.
const getLevel = () => {
  const current = props.level;
  return typeof current === 'function' ? current() : current;
};
const getMotion = () => {
  const current = props.motion;
  return typeof current === 'function' ? current() : current;
};
const report = (value: number) => emit('level', value);

watch(
  // a stream held in a deep ref arrives proxied; Web Audio needs the real one
  [() => JSON.stringify(driverConfig.value), () => toRaw(props.stream) ?? null, () => (isActive.value || isFading.value) && isVisible.value, root],
  ([, s, running, el], _old, onCleanup) => {
    if (!running || !el) return;
    onCleanup(registerVoiceInstance(el, driverConfig.value, { stream: s, getLevel, getMotion }, report));
  },
  { flush: 'post', immediate: true }
);
</script>

<template>
  <div
    ref="root"
    :data-voice-beam="id"
    :data-voice-type="type"
    :data-voice-look="effLook"
    data-voice-halfres=""
    :data-active="isActive && !isFading ? '' : undefined"
    :data-fading="isFading ? '' : undefined"
    :data-paused="isActive && !isFading && (!isVisible || paused) ? '' : undefined"
    :data-listening="stream ? '' : undefined"
    :style="{ '--voice-strength': Math.max(0, Math.min(1, r.strength)) }"
    @animationend="onAnimationEnd"
  >
    <slot />
    <canvas v-if="isSurface" data-voice-beam-surface aria-hidden="true" />
    <template v-else>
      <div data-voice-beam-bloom />
      <!-- Mirrors of the inner light and bloom, clipped to below the band
           line and carrying the displacement filter. -->
      <template v-if="r.distortion > 0">
        <div data-voice-beam-warp="inner" />
        <div data-voice-beam-warp="bloom" />
      </template>
      <canvas v-if="!CANVAS_FILTER" data-voice-beam-band-halo aria-hidden="true" />
      <canvas data-voice-beam-band aria-hidden="true" />
      <!-- After the band canvases, so the wash sits over the band's halo
           under the line (it is clipped to below the line, so the ridge
           itself stays) while the host's own content stays above it. -->
      <div v-if="r.coreLight > 0" data-voice-beam-core><div /></div>
      <!-- The distortion filter: drifting fractal noise, its green channel
           pinned to 0.5 so only x displaces, driven per frame by the driver
           (scale and offset), which also narrows the region to the strip
           under the band line once it runs; the full box here is only the
           first frame. Zero-sized, so it takes no room. -->
      <svg
        v-if="r.distortion > 0"
        aria-hidden="true"
        width="0"
        height="0"
        style="position: absolute; pointer-events: none"
      >
        <filter
          :id="`vb-distort-${id}`"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          color-interpolation-filters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            :baseFrequency="`${(0.012 * r.distortionDetail).toFixed(4)} ${(0.05 * r.distortionDetail).toFixed(4)}`"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feOffset in="noise" dx="0" dy="0" result="moved" />
          <feColorMatrix
            in="moved"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1"
            result="map"
          />
          <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
    </template>
    <!-- Last, so the first child stays the wrapped content (radius
         detection) and the component keeps a single root for attrs. -->
    <component :is="'style'">{{ cssStyles }}</component>
  </div>
</template>
