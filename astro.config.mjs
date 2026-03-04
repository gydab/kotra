import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import svelte from '@astrojs/svelte';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'static',
  adapter: vercel(),

  integrations: [svelte()],

  vite: {
    plugins: [tailwindcss()],
  },

  i18n: {
    defaultLocale: 'is',
    locales: ['is', 'en'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
