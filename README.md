# Extend @vitejs/plugin-legacy

Add option `modernTargets` to `@vitejs/plugin-legacy` before official support: 

- https://github.com/vitejs/vite/issues/14527
- https://github.com/vitejs/vite/issues/6922
- https://github.com/vitejs/vite/issues/10093

```ts
legacy({
  targets: ['chrome 87', 'safari 13', 'firefox 78', 'edge 88'],
  // use modernTargets
  modernPolyfills: true,
  modernTargets: [
    'defaults',
    'chrome 87',
    'safari 13',
    'firefox 78',
    'edge 88'
  ]
})
```