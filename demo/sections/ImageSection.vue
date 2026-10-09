<script setup lang="ts">
import { ref } from 'vue';
import { ImageGeneration, type ImageGenerationCycleEvent, type ImageGenerationHandle, type ImageGenerationPreset } from '../../src/image';

const IMAGES = ['./photo-1.jpg', './photo-2.jpg', './photo-3.jpg'];
const PRESETS: ImageGenerationPreset[] = ['pixels-organic', 'pixels-mechanic', 'sweep-gradient'];

// no two cards show the same image at once
const inUse = new Map<string, string>();
const exclude = () => [...inUse.values()];
const track = (id: string, e: ImageGenerationCycleEvent) => {
  if (e.phase === 'reveal' && e.src) inUse.set(id, e.src);
  else if (e.phase === 'idle') inUse.delete(id);
};

const preset = ref<ImageGenerationPreset>('pixels-organic');
const paused = ref(false);
const revealed = ref(false);
const stage = ref<ImageGenerationHandle | null>(null);

function onStageCycle(e: ImageGenerationCycleEvent) {
  track('stage', e);
  if (e.phase === 'reveal' || e.phase === 'visible') revealed.value = true;
  else if (e.phase === 'idle') revealed.value = false;
}
function toggleReveal() {
  const h = stage.value;
  if (!h) return;
  if (h.isImageActive()) h.triggerHide();
  else h.triggerReveal({ hold: 'manual' });
}
</script>

<template>
  <section>
    <div class="section-head">
      <h2>Image</h2>
      <div class="controls mono">
        <select v-model="preset" class="btn mono">
          <option v-for="p in PRESETS" :key="p" :value="p">{{ p }}</option>
        </select>
        <button class="btn mono" type="button" :disabled="paused" @click="toggleReveal">
          {{ revealed ? 'HIDE' : 'REVEAL' }}
        </button>
        <button class="btn mono" type="button" :disabled="paused || !revealed" @click="stage?.triggerRegenerate({ durationMs: 3000 })">
          REGENERATE
        </button>
        <button class="btn mono" type="button" @click="paused = !paused">{{ paused ? 'PLAY' : 'PAUSE' }}</button>
      </div>
    </div>

    <ImageGeneration ref="stage" class="fill" :preset="preset" :images="IMAGES" :paused="paused" :exclude-srcs="exclude" @cycle="onStageCycle">
      <div class="surface wide" />
    </ImageGeneration>

    <div class="auto">
      <figure v-for="(p, i) in PRESETS" :key="p">
        <ImageGeneration
          class="fill"
          :preset="p"
          :images="IMAGES"
          auto-reveal
          :reveal-initial-delay="i === 0 ? 1 : [1.5, 3.5]"
          :reveal-hold-ms="[1500, 2500]"
          :exclude-srcs="exclude"
          @cycle="track(p, $event)"
        >
          <div class="surface" />
        </ImageGeneration>
        <figcaption class="mono faint">{{ p }} · auto</figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.fill {
  display: block;
  width: 100%;
}

.surface {
  aspect-ratio: 1;
  border-radius: 10px;
}

.surface.wide {
  aspect-ratio: 2.4;
}

section > .fill {
  margin-top: 18px;
}

.auto {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  padding: 10px 0 34px;
}

figure {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
