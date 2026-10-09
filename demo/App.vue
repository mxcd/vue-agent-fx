<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { type OrbState, ThinkingOrb } from '../src';

const STATES: Array<{ state: OrbState; blurb: string }> = [
  { state: 'working', blurb: 'particles on tilted orbits' },
  { state: 'searching', blurb: 'a scan meridian sweeps the field' },
  { state: 'solving', blurb: 'bands scramble, then click back' },
  { state: 'listening', blurb: 'a waveform rolls through the rings' },
  { state: 'connecting', blurb: 'a constellation wires itself' },
  { state: 'weaving', blurb: 'three strands plait around the sphere' },
  { state: 'composing', blurb: 'an undulating sash of bands' },
  { state: 'breathing', blurb: 'a ring slowly morphing' },
  { state: 'shaping', blurb: 'circle → triangle → square' }
];

const dark = ref(true);
const speed = ref(1);
const paused = ref(false);

// drive the ancestor data-theme attribute, the signal theme="auto" reads
watchEffect(() => document.documentElement.setAttribute('data-theme', dark.value ? 'dark' : 'light'));
</script>

<template>
  <div class="page">
    <header>
      <span class="mono">THINKING-ORBS · VUE</span>
      <div class="controls mono">
        <label>
          SPEED {{ speed.toFixed(1) }}
          <input v-model.number="speed" type="range" min="0.2" max="3" step="0.1" />
        </label>
        <button class="btn mono" type="button" @click="paused = !paused">{{ paused ? 'PLAY' : 'PAUSE' }}</button>
        <button class="btn mono" type="button" @click="dark = !dark">{{ dark ? 'LIGHT' : 'DARK' }}</button>
      </div>
    </header>

    <section class="grid">
      <div v-for="{ state, blurb } in STATES" :key="state" class="card">
        <div class="pair">
          <ThinkingOrb :state="state" :size="64" :speed="speed" :paused="paused" />
          <ThinkingOrb :state="state" :size="20" :speed="speed" :paused="paused" />
        </div>
        <div class="text">
          <span class="title">{{ state }}</span>
          <span class="sub">{{ blurb }}</span>
        </div>
      </div>
    </section>

    <footer class="mono faint">
      Vue port of
      <a href="https://github.com/Jakubantalik/thinking-orbs">thinking-orbs</a> by Jakub Antalik ·
      <a href="https://github.com/mxcd/thinking-orbs">source</a>
    </footer>
  </div>
</template>
