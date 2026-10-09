# thinking-orbs-vue

Vue 3 port of [thinking-orbs](https://github.com/Jakubantalik/thinking-orbs) by Jakub Antalik: dotted thought-orb loading indicators for AI & agent UIs. Nine animated states, two tuned sizes, auto dark/light, plain 2D canvas.

[Live demo](https://mxcd.github.io/thinking-orbs/)

## Usage

```bash
bun add github:mxcd/thinking-orbs
```

```vue
<script setup lang="ts">
import { ThinkingOrb } from 'thinking-orbs-vue';
</script>

<template>
  <ThinkingOrb state="searching" :size="64" />
</template>
```

Ships as TypeScript/SFC source, so it needs a bundler with `@vitejs/plugin-vue` (Vite, Nuxt, Quasar).

## Props

| Prop | Type | Default |
|---|---|---|
| `state` | `working \| searching \| solving \| listening \| connecting \| weaving \| composing \| breathing \| shaping` | `working` |
| `size` | `64 \| 20` | `64` |
| `theme` | `auto \| dark \| light` | `auto` |
| `speed` | `number` (multiplier) | `1` |
| `paused` | `boolean` | `false` |
| `aria-label` | `string` | per-state label |

`theme="auto"` reads the nearest ancestor `data-theme="dark|light"` or `.dark`/`.light` class (watched live), else `prefers-color-scheme`. Other attrs (`class`, `style`, ...) fall through to the `<canvas>`.

Same behaviour as the React original: shared clock keeps all orbs in phase, pauses offscreen and on hidden tabs, static frame under `prefers-reduced-motion`, DPR capped at 2.

## Development

```bash
bun install
bun run dev        # demo
bun run build      # demo -> dist-demo (deployed to GitHub Pages on push to main)
bun run typecheck
```

`src/engine/` and `src/presets.ts` are copied verbatim from upstream (`de85557`); only the component layer is Vue. To pull upstream tuning changes, re-copy those files.
