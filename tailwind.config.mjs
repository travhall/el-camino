/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Surfaces
        surface: {
          primary: "hsl(var(--surface-primary) / <alpha-value>)",
          secondary: "hsl(var(--surface-secondary) / <alpha-value>)",
          tertiary: "hsl(var(--surface-tertiary) / <alpha-value>)",
        },
        // Borders
        border: {
          primary: "hsl(var(--border-primary) / <alpha-value>)",
          secondary: "hsl(var(--border-secondary) / <alpha-value>)",
          tertiary: "hsl(var(--border-tertiary) / <alpha-value>)",
        },
        // UI Elements
        ui: {
          nav: {
            surface: "hsl(var(--ui-nav-surface) / <alpha-value>)",
            text: "hsl(var(--ui-nav-text) / <alpha-value>)",
            border: "hsl(var(--ui-nav-border) / <alpha-value>)",
            hover: "hsl(var(--ui-nav-hover) / <alpha-value>)",
          },
          button: {
            surface: "hsl(var(--ui-button-surface) / <alpha-value>)",
            text: "hsl(var(--ui-button-text) / <alpha-value>)",
            border: "hsl(var(--ui-button-border) / <alpha-value>)",
            ring: "hsl(var(--ui-button-ring) / <alpha-value>)",
          },
          card: {
            surface: "hsl(var(--ui-card-surface) / <alpha-value>)",
            text: "hsl(var(--ui-card-text) / <alpha-value>)",
            border: "hsl(var(--ui-card-border) / <alpha-value>)",
            hover: "hsl(var(--ui-card-hover) / <alpha-value>)",
          },
          input: {
            surface: "hsl(var(--ui-input-surface) / <alpha-value>)",
            text: "hsl(var(--ui-input-text) / <alpha-value>)",
            border: "hsl(var(--ui-input-border) / <alpha-value>)",
            focus: "hsl(var(--ui-input-focus) / <alpha-value>)",
          },
        },
        // Content
        content: {
          heading: "hsl(var(--content-heading) / <alpha-value>)",
          body: "hsl(var(--content-body) / <alpha-value>)",
          meta: "hsl(var(--content-meta) / <alpha-value>)",
          emphasis: "hsl(var(--content-emphasis) / <alpha-value>)",
          caption: "hsl(var(--content-caption) / <alpha-value>)",
        },
        // Product
        product: {
          heading: "hsl(var(--product-heading) / <alpha-value>)",
          body: "hsl(var(--product-body) / <alpha-value>)",
          meta: "hsl(var(--product-meta) / <alpha-value>)",
          emphasis: "hsl(var(--product-emphasis) / <alpha-value>)",
          caption: "hsl(var(--product-caption) / <alpha-value>)",
          price: "hsl(var(--product-price) / <alpha-value>)",
          discount: "hsl(var(--product-discount) / <alpha-value>)",
          variation: "hsl(var(--product-variation) / <alpha-value>)",
          stock: "hsl(var(--product-stock) / <alpha-value>)",
          category: "hsl(var(--product-category) / <alpha-value>)",
        },
        // State
        state: {
          success: {
            surface: "hsl(var(--state-success-surface) / <alpha-value>)",
            text: "hsl(var(--state-success-text) / <alpha-value>)",
          },
          error: {
            surface: "hsl(var(--state-error-surface) / <alpha-value>)",
            text: "hsl(var(--state-error-text) / <alpha-value>)",
          },
          warning: {
            surface: "hsl(var(--state-warning-surface) / <alpha-value>)",
            text: "hsl(var(--state-warning-text) / <alpha-value>)",
          },
          info: {
            surface: "hsl(var(--state-info-surface) / <alpha-value>)",
            text: "hsl(var(--state-info-text) / <alpha-value>)",
          },
        },
        // Brand Colors
        elco: {
          beeswax: {
            50: "hsl(var(--elco-beeswax-50) / <alpha-value>)",
            100: "hsl(var(--elco-beeswax-100) / <alpha-value>)",
            200: "hsl(var(--elco-beeswax-200) / <alpha-value>)",
            300: "hsl(var(--elco-beeswax-300) / <alpha-value>)",
            400: "hsl(var(--elco-beeswax-400) / <alpha-value>)",
            500: "hsl(var(--elco-beeswax-500) / <alpha-value>)",
            600: "hsl(var(--elco-beeswax-600) / <alpha-value>)",
            700: "hsl(var(--elco-beeswax-700) / <alpha-value>)",
            800: "hsl(var(--elco-beeswax-800) / <alpha-value>)",
            900: "hsl(var(--elco-beeswax-900) / <alpha-value>)",
          },
          "black-pearl": {
            50: "hsl(var(--elco-black-pearl-50) / <alpha-value>)",
            100: "hsl(var(--elco-black-pearl-100) / <alpha-value>)",
            200: "hsl(var(--elco-black-pearl-200) / <alpha-value>)",
            300: "hsl(var(--elco-black-pearl-300) / <alpha-value>)",
            400: "hsl(var(--elco-black-pearl-400) / <alpha-value>)",
            500: "hsl(var(--elco-black-pearl-500) / <alpha-value>)",
            600: "hsl(var(--elco-black-pearl-600) / <alpha-value>)",
            700: "hsl(var(--elco-black-pearl-700) / <alpha-value>)",
            800: "hsl(var(--elco-black-pearl-800) / <alpha-value>)",
            900: "hsl(var(--elco-black-pearl-900) / <alpha-value>)",
          },
          "fig-leaf": {
            50: "hsl(var(--elco-fig-leaf-50) / <alpha-value>)",
            100: "hsl(var(--elco-fig-leaf-100) / <alpha-value>)",
            200: "hsl(var(--elco-fig-leaf-200) / <alpha-value>)",
            300: "hsl(var(--elco-fig-leaf-300) / <alpha-value>)",
            400: "hsl(var(--elco-fig-leaf-400) / <alpha-value>)",
            500: "hsl(var(--elco-fig-leaf-500) / <alpha-value>)",
            600: "hsl(var(--elco-fig-leaf-600) / <alpha-value>)",
            700: "hsl(var(--elco-fig-leaf-700) / <alpha-value>)",
            800: "hsl(var(--elco-fig-leaf-800) / <alpha-value>)",
            900: "hsl(var(--elco-fig-leaf-900) / <alpha-value>)",
          },
          "honey-cream": {
            50: "hsl(var(--elco-honey-cream-50) / <alpha-value>)",
            100: "hsl(var(--elco-honey-cream-100) / <alpha-value>)",
            200: "hsl(var(--elco-honey-cream-200) / <alpha-value>)",
            300: "hsl(var(--elco-honey-cream-300) / <alpha-value>)",
            400: "hsl(var(--elco-honey-cream-400) / <alpha-value>)",
            500: "hsl(var(--elco-honey-cream-500) / <alpha-value>)",
            600: "hsl(var(--elco-honey-cream-600) / <alpha-value>)",
            700: "hsl(var(--elco-honey-cream-700) / <alpha-value>)",
            800: "hsl(var(--elco-honey-cream-800) / <alpha-value>)",
            900: "hsl(var(--elco-honey-cream-900) / <alpha-value>)",
          },
          "sweet-tea": {
            50: "hsl(var(--elco-sweet-tea-50) / <alpha-value>)",
            100: "hsl(var(--elco-sweet-tea-100) / <alpha-value>)",
            200: "hsl(var(--elco-sweet-tea-200) / <alpha-value>)",
            300: "hsl(var(--elco-sweet-tea-300) / <alpha-value>)",
            400: "hsl(var(--elco-sweet-tea-400) / <alpha-value>)",
            500: "hsl(var(--elco-sweet-tea-500) / <alpha-value>)",
            600: "hsl(var(--elco-sweet-tea-600) / <alpha-value>)",
            700: "hsl(var(--elco-sweet-tea-700) / <alpha-value>)",
            800: "hsl(var(--elco-sweet-tea-800) / <alpha-value>)",
            900: "hsl(var(--elco-sweet-tea-900) / <alpha-value>)",
          },
        },
      },
      fontFamily: {
        display: ["Alumni", "serif"],
        "display-italic": ["Alumni Italic", "serif"],
        sans: ["Cabin", "sans-serif"],
      },
      fontSize: {
        // Display font sizes (Alumni)
        'display-xs': ['1.25rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],      // 20px
        'display-sm': ['1.5rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }],       // 24px
        'display-base': ['2rem', { lineHeight: '1.3', letterSpacing: '-0.02em' }],       // 32px
        'display-lg': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],       // 40px
        'display-xl': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],         // 48px
        'display-2xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],     // 60px

        // Body font sizes (Cabin)
        'body-xs': ['0.875rem', { lineHeight: '1.5' }],    // 14px
        'body-sm': ['1rem', { lineHeight: '1.5' }],        // 16px
        'body-base': ['1.125rem', { lineHeight: '1.5' }],  // 18px
        'body-lg': ['1.25rem', { lineHeight: '1.5' }],     // 20px
        'body-xl': ['1.5rem', { lineHeight: '1.4' }],      // 24px
      },
    },
  },
  plugins: [],
};
