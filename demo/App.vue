<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import BeamSection from './sections/BeamSection.vue';
import ImageSection from './sections/ImageSection.vue';
import OrbsSection from './sections/OrbsSection.vue';
import VoiceSection from './sections/VoiceSection.vue';

const dark = ref(true);

// drive the ancestor data-theme attribute, the signal theme="auto" reads
watchEffect(() => document.documentElement.setAttribute('data-theme', dark.value ? 'dark' : 'light'));
</script>

<template>
  <div class="page">
    <header>
      <span class="mono">LIBRARIES.DEV · VUE</span>
      <nav class="controls mono">
        <a href="#orbs">ORBS</a>
        <a href="#beam">BEAM</a>
        <a href="#voice">VOICE</a>
        <a href="#image">IMAGE</a>
        <button class="btn mono" type="button" @click="dark = !dark">{{ dark ? 'LIGHT' : 'DARK' }}</button>
      </nav>
    </header>

    <OrbsSection id="orbs" />
    <BeamSection id="beam" />
    <VoiceSection id="voice" />
    <ImageSection id="image" />

    <footer class="mono faint">
      Vue port of
      <a href="https://github.com/Jakubantalik/Libraries.dev">Libraries.dev</a> by Jakub Antalik ·
      <a href="https://github.com/mxcd/thinking-orbs">source</a>
    </footer>
  </div>
</template>
