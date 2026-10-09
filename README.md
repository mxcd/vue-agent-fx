# vue-agent-fx

Effects for AI & agent UIs in Vue 3: a port of [Libraries.dev](https://github.com/Jakubantalik/Libraries.dev) by Jakub Antalik.

| Component | Import | Upstream docs (props are identical) |
|---|---|---|
| `ThinkingOrb` | `vue-agent-fx/orbs` | [thinking-orbs](https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/thinking-orbs) |
| `BorderBeam` | `vue-agent-fx/beam` | [border-beam](https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/border-beam) |
| `VoiceBeam`, `useMicrophone` | `vue-agent-fx/voice` | [voice-glow](https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/voice-glow) |
| `ImageGeneration` | `vue-agent-fx/image` (needs `three`) | [img-fx](https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/img-fx) |

[Live demo](https://mxcd.github.io/vue-agent-fx/)

## Usage

```bash
bun add vue-agent-fx
bun add three   # only for ImageGeneration
```

```vue
<script setup lang="ts">
import { BorderBeam, ThinkingOrb, VoiceBeam, useMicrophone } from 'vue-agent-fx';
import { ImageGeneration } from 'vue-agent-fx/image';

const mic = useMicrophone({ constraints: { echoCancellation: true, noiseSuppression: true } });
</script>

<template>
  <ThinkingOrb state="searching" :size="32" color="#7c9cff" />

  <BorderBeam theme="auto" size="md">
    <div class="card">Generating report</div>
  </BorderBeam>

  <VoiceBeam theme="auto" :stream="mic.stream.value" :active="mic.state.value === 'live'">
    <textarea />
  </VoiceBeam>

  <ImageGeneration theme="auto" :images="['/a.jpg', '/b.jpg']" auto-reveal>
    <div class="card" />
  </ImageGeneration>
</template>
```

Compiled ES modules with types; `vue` >= 3.5 (and `three` for image) are peer dependencies.

## Vue differences from the React packages

- Wrapped children go in the default slot; `class`, `style` and listeners fall through.
- Callback props are events: `onActivate`/`onDeactivate` -> `@activate`/`@deactivate` (beam, voice), `onLevel` -> `@level`, `onCycle` -> `@cycle`.
- Refs: beam and voice expose `el`; `ImageGeneration` exposes the upstream handle (`triggerReveal`, `triggerHide`, `triggerRegenerate`, `isImageActive`, `element`) via a template ref typed `ImageGenerationHandle`.
- `useMicrophone` returns refs (`stream`, `state`, `error`) and stops the stream when the owning component unmounts.
- `theme="auto"` everywhere uses one shared resolver: nearest ancestor `data-theme` / `.dark` / `.light`, then `<html>` `color-scheme`, then `prefers-color-scheme`; all live. Defaults match upstream (orbs and image `auto`, beam and voice `dark`).
- voice: upstream's build-time `__VOICE_SURFACE__` flag is a constant `false` (the experimental dots/lines looks stay off, as in upstream's default build).

## Development

```bash
bun install
bun run dev        # demo
bun run build      # demo -> dist-demo (deployed to GitHub Pages on push to main)
bun run typecheck
bun run build:lib  # package -> dist (runs on publish)
```

Framework-agnostic upstream files (engines, styles, presets, drivers) are copied verbatim from Libraries.dev `bcaf88f`; only the component layer is Vue. To pull upstream changes, re-copy those files. Not ported: bot-avatars, liquid-gooey, metal-fx, and Pro/Studio content.

Demo photos in `demo/public/` are AI-generated for this repo.
