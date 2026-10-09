import { onBeforeUnmount, onMounted, type Ref, ref } from 'vue';

function ancestorTheme(el: Element | null): boolean | null {
  for (let node = el; node; node = node.parentElement) {
    const attr = node.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    if (node.classList.contains('dark')) return true;
    if (node.classList.contains('light')) return false;
  }
  const scheme = getComputedStyle(document.documentElement).colorScheme;
  if (scheme === 'dark' || scheme === 'light') return scheme === 'dark';
  return null;
}

/**
 * Live dark/light for `theme="auto"`: the nearest ancestor `data-theme` or
 * `.dark`/`.light` class from `start`, else `prefers-color-scheme`; both
 * watched. `true` until mounted (SSR fallback). Call before the component's
 * own onMounted so the theme is resolved when that runs.
 */
export function useAutoDark(start: () => Element | null | undefined): Ref<boolean> {
  const dark = ref(true);
  let stop = () => {};
  onMounted(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const resolve = () => {
      dark.value = ancestorTheme(start() ?? null) ?? mq.matches;
    };
    resolve();
    mq.addEventListener('change', resolve);
    // live app-level toggles: class/data-theme flips anywhere in the tree
    const mo = new MutationObserver(resolve);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
      subtree: true
    });
    stop = () => {
      mq.removeEventListener('change', resolve);
      mo.disconnect();
    };
  });
  onBeforeUnmount(() => stop());
  return dark;
}
