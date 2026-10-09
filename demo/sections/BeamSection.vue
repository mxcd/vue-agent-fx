<script setup lang="ts">
import { computed, ref } from 'vue';
import { BorderBeam, type BorderBeamColorVariant, type BorderBeamSize } from '../../src/beam';

const SIZES: BorderBeamSize[] = ['md', 'sm', 'line', 'pulse-inner', 'pulse-outside'];
const COLORS: BorderBeamColorVariant[] = ['colorful', 'mono', 'ocean', 'sunset', 'forest', 'candy', 'ice', 'gold'];

// tuned vars the upstream demo applies so the outward bloom reads right
const PULSE_OUTSIDE_TUNED_VARS = {
  '--sub-glow-offset-x': '1px',
  '--sub-glow-offset-y': '0px',
  '--sub-core-blur': '10px',
  '--sub-bloom-blur': '19px',
  '--sub-glow-opacity-mul': 1.71
};

const size = ref<BorderBeamSize>('md');
const colorVariant = ref<BorderBeamColorVariant>('colorful');
const strength = ref(1);
const active = ref(true);

const beam = computed(() => ({
  size: size.value,
  colorVariant: colorVariant.value,
  strength: strength.value,
  active: active.value,
  theme: 'auto' as const,
  style: size.value === 'pulse-outside' ? PULSE_OUTSIDE_TUNED_VARS : undefined
}));
</script>

<template>
  <section>
    <div class="section-head">
      <h2>Border beam</h2>
      <div class="controls mono">
        <label>
          SIZE
          <select v-model="size" class="btn mono">
            <option v-for="s in SIZES" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <label>
          COLOR
          <select v-model="colorVariant" class="btn mono">
            <option v-for="c in COLORS" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <label>
          STRENGTH {{ strength.toFixed(2) }}
          <input v-model.number="strength" type="range" min="0" max="1" step="0.05" />
        </label>
        <button class="btn mono" type="button" @click="active = !active">{{ active ? 'PAUSE' : 'PLAY' }}</button>
      </div>
    </div>
    <div class="stage">
      <BorderBeam v-bind="beam">
        <div class="card beam-card">
          <div class="text">
            <span class="title">Generating report</span>
            <span class="sub">The beam rides the border of any element and picks up its radius.</span>
          </div>
        </div>
      </BorderBeam>
      <div class="row">
        <BorderBeam v-bind="beam" style="width: fit-content">
          <button class="btn beam-btn" type="button">Subscribe</button>
        </BorderBeam>
        <BorderBeam v-bind="beam" style="flex: 1">
          <input class="beam-input" type="text" placeholder="Search anything..." />
        </BorderBeam>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stage {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 36px 0 34px;
}

.row {
  display: flex;
  align-items: center;
  gap: 28px;
}

.beam-card {
  min-height: 120px;
  border: 1px solid var(--line);
}

.beam-btn {
  display: block;
  padding: 10px 22px;
  border-radius: 999px;
  background: var(--card);
}

.beam-input {
  display: block;
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--card);
  color: var(--fg);
  font: inherit;
  outline: none;
}
</style>
