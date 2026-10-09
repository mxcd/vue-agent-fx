<script setup lang="ts">
import { computed, ref } from 'vue';
import { type VoiceBeamColorVariant, VoiceBeam, useMicrophone } from '../../src/voice';

/* Synthetic speech envelope from the upstream demo: syllables riding
   words, a pause at the end of each 9 s phrase. Lets the glow be judged
   without microphone permission. */
function demoLevel(t: number): number {
  const phrase = t % 9;
  if (phrase > 6.6) return 0;
  const syllable = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 3.1);
  const word = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.55 + 1);
  const rough = 0.86 + 0.14 * Math.sin(t * 23.7);
  return Math.min(1, Math.pow(syllable, 1.6) * (0.5 + 0.5 * word) * rough * 1.05);
}
const demoGetter = () => demoLevel(performance.now() / 1000);

const MIC_STATUS: Record<string, string> = {
  requesting: 'waiting for permission…',
  live: 'listening',
  denied: 'microphone blocked, allow it in the site settings',
  unsupported: "this browser can't capture audio",
  error: "couldn't open the microphone",
};
const VARIANTS: VoiceBeamColorVariant[] = ['colorful', 'mono', 'ocean', 'sunset', 'forest', 'candy', 'ice', 'gold'];

const source = ref<'demo' | 'manual'>('demo');
const manual = ref(0.6);
const variant = ref<VoiceBeamColorVariant>('colorful');
const paused = ref(false);

// a demo page has no playback to echo, but room noise would keep it twitching
const { stream, state, start, stop } = useMicrophone({
  constraints: { echoCancellation: true, noiseSuppression: true },
});
const live = computed(() => state.value === 'live');
const toggleMic = () => (stream.value ? stop() : void start());
// the stream, when there is one, wins over `level`
const level = computed(() => (source.value === 'demo' ? demoGetter : manual.value));
</script>

<template>
  <section>
    <div class="section-head">
      <h2>Voice</h2>
      <div class="controls mono">
        <label>
          SOURCE
          <select v-model="source" class="btn mono" :disabled="live">
            <option value="demo">demo voice</option>
            <option value="manual">manual</option>
          </select>
        </label>
        <label v-if="source === 'manual' && !live">
          LEVEL {{ manual.toFixed(2) }}
          <input v-model.number="manual" type="range" min="0" max="1" step="0.01" />
        </label>
        <label>
          COLOR
          <select v-model="variant" class="btn mono">
            <option v-for="v in VARIANTS" :key="v" :value="v">{{ v }}</option>
          </select>
        </label>
        <button class="btn mono" type="button" @click="toggleMic">{{ stream ? 'STOP MIC' : 'MIC' }}</button>
        <button class="btn mono" type="button" @click="paused = !paused">{{ paused ? 'PLAY' : 'PAUSE' }}</button>
      </div>
    </div>
    <p class="mono faint status">{{ MIC_STATUS[state] ?? '' }}&nbsp;</p>

    <div class="stage card">
      <VoiceBeam theme="auto" :stream="stream" :level="level" :color-variant="variant" :paused="paused" class="chat-host">
        <form class="chat" aria-label="Chat input example" @submit.prevent>
          <input class="chat-input" type="text" placeholder="Ask me anything.." aria-label="Message" autocomplete="off" />
          <div class="chat-row">
            <button type="button" class="chat-btn" aria-label="Add">+</button>
            <button
              type="button"
              class="chat-btn mono"
              :class="{ on: stream }"
              :aria-pressed="!!stream"
              aria-label="Microphone"
              @click="toggleMic"
            >
              {{ stream ? 'STOP' : 'MIC' }}
            </button>
          </div>
        </form>
      </VoiceBeam>

      <VoiceBeam type="pill" theme="auto" :stream="stream" :level="level" :color-variant="variant" :paused="paused">
        <div class="pill mono"><span class="dot" />{{ stream ? 'LISTENING' : 'RECORDING' }}</div>
      </VoiceBeam>
    </div>
  </section>
</template>

<style scoped>
.status {
  padding-top: 8px;
}

.stage {
  flex-direction: column;
  gap: 40px;
  margin-top: 14px;
  padding: 48px 24px 56px;
}

.chat-host {
  width: min(100%, 371px);
}

.chat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: var(--bg);
}

.chat-input {
  background: none;
  border: none;
  outline: none;
  color: var(--fg);
  font-size: 15px;
  padding: 4px 2px 10px;
}

.chat-input::placeholder {
  color: var(--faint);
}

.chat-row {
  display: flex;
  justify-content: space-between;
}

/* above the glow's layers (z-index up to 4): they ignore the pointer
   anyway, this keeps the buttons from being tinted over */
.chat-btn {
  position: relative;
  z-index: 5;
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: var(--card);
  color: var(--fg);
  cursor: pointer;
}

.chat-btn.on {
  background: var(--fg);
  color: var(--bg);
}

.pill {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 150px;
  height: 44px;
  padding: 0 16px;
  border-radius: 22px;
  border: 1px solid var(--line);
  background: var(--bg);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff4d4f;
}
</style>
