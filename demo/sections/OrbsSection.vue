<script setup lang="ts">
import { ref } from 'vue';
import { type OrbState, ThinkingOrb } from '../../src/orbs';

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

const speed = ref(1);
const paused = ref(false);
const color = ref('');
</script>

<template>
  <section>
    <div class="section-head">
      <h2>Thinking orbs</h2>
      <div class="controls mono">
        <label>
          SPEED {{ speed.toFixed(1) }}
          <input v-model.number="speed" type="range" min="0.2" max="3" step="0.1" />
        </label>
        <label>
          TINT
          <select v-model="color" class="btn mono">
            <option value="">none</option>
            <option value="#7c9cff">blue</option>
            <option value="#ff8a5c">orange</option>
            <option value="#5fd4a0">green</option>
          </select>
        </label>
        <button class="btn mono" type="button" @click="paused = !paused">{{ paused ? 'PLAY' : 'PAUSE' }}</button>
      </div>
    </div>
    <div class="grid">
      <div v-for="{ state, blurb } in STATES" :key="state" class="card">
        <div class="pair">
          <ThinkingOrb :state="state" :size="64" :speed="speed" :paused="paused" :color="color || undefined" />
          <ThinkingOrb :state="state" :size="32" :speed="speed" :paused="paused" :color="color || undefined" />
          <ThinkingOrb :state="state" :size="20" :speed="speed" :paused="paused" :color="color || undefined" />
        </div>
        <div class="text">
          <span class="title">{{ state }}</span>
          <span class="sub">{{ blurb }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
