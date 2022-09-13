# Extend @vitejs/plugin-legacy

Add option `modernTargets` to @vitejs/plugin-legacy: https://github.com/vitejs/vite/issues/10093.

```ts
legacy({
  targets: ['chrome 87', 'safari 13', 'firefox 78', 'edge 88'],
  modernPolyfills: true,
  modernTargets: {
    browsers: [
      // 'defaults',
      'chrome 87',
      'safari 13',
      'firefox 78',
      'edge 88'
    ]
  }
})
```