'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const path = require('node:path');
const node_crypto = require('node:crypto');
const node_module = require('node:module');
const node_url = require('node:url');
const vite = require('vite');
const MagicString = require('magic-string');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e["default"] : e; }

const path__default = /*#__PURE__*/_interopDefaultLegacy(path);
const MagicString__default = /*#__PURE__*/_interopDefaultLegacy(MagicString);

let babel;
async function loadBabel() {
  if (!babel) {
    babel = await import('@babel/standalone');
  }
  return babel;
}
function toOutputFilePathInHtml(filename, type, hostId, hostType, config, toRelative) {
  const { renderBuiltUrl } = config.experimental;
  let relative = config.base === "" || config.base === "./";
  if (renderBuiltUrl) {
    const result = renderBuiltUrl(filename, {
      hostId,
      hostType,
      type,
      ssr: !!config.build.ssr
    });
    if (typeof result === "object") {
      if (result.runtime) {
        throw new Error(
          `{ runtime: "${result.runtime}" } is not supported for assets in ${hostType} files: ${filename}`
        );
      }
      if (typeof result.relative === "boolean") {
        relative = result.relative;
      }
    } else if (result) {
      return result;
    }
  }
  if (relative && !config.build.ssr) {
    return toRelative(filename, hostId);
  } else {
    return config.base + filename;
  }
}
function getBaseInHTML(urlRelativePath, config) {
  return config.base === "./" || config.base === "" ? path__default.posix.join(
    path__default.posix.relative(urlRelativePath, "").slice(0, -2),
    "./"
  ) : config.base;
}
function toAssetPathFromHtml(filename, htmlPath, config) {
  const relativeUrlPath = vite.normalizePath(path__default.relative(config.root, htmlPath));
  const toRelative = (filename2, hostId) => getBaseInHTML(relativeUrlPath, config) + filename2;
  return toOutputFilePathInHtml(
    filename,
    "asset",
    htmlPath,
    "html",
    config,
    toRelative
  );
}
const safari10NoModuleFix = `!function(){var e=document,t=e.createElement("script");if(!("noModule"in t)&&"onbeforeload"in t){var n=!1;e.addEventListener("beforeload",(function(e){if(e.target===t)n=!0;else if(!e.target.hasAttribute("nomodule")||!n)return;e.preventDefault()}),!0),t.type="module",t.src=".",e.head.appendChild(t),t.remove()}}();`;
const legacyPolyfillId = "vite-legacy-polyfill";
const legacyEntryId = "vite-legacy-entry";
const systemJSInlineCode = `System.import(document.getElementById('${legacyEntryId}').getAttribute('data-src'))`;
const detectModernBrowserVarName = "__vite_is_modern_browser";
const detectModernBrowserCode = `try{import.meta.url;import("_").catch(()=>1);}catch(e){}window.${detectModernBrowserVarName}=true;`;
const dynamicFallbackInlineCode = `!function(){if(window.${detectModernBrowserVarName})return;console.warn("vite: loading legacy build because dynamic import or import.meta.url is unsupported, syntax error above should be ignored");var e=document.getElementById("${legacyPolyfillId}"),n=document.createElement("script");n.src=e.src,n.onload=function(){${systemJSInlineCode}},document.body.appendChild(n)}();`;
const forceDynamicImportUsage = `export function __vite_legacy_guard(){import('data:text/javascript,')};`;
const legacyEnvVarMarker = `__VITE_IS_LEGACY__`;
const _require = node_module.createRequire((typeof document === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : (document.currentScript && document.currentScript.src || new URL('index.cjs', document.baseURI).href)));
function viteLegacyPlugin(options = {}) {
  let config;
  const targets = options.targets || "defaults";
  const genLegacy = options.renderLegacyChunks !== false;
  const genDynamicFallback = genLegacy;
  const debugFlags = (process.env.DEBUG || "").split(",");
  const isDebug = debugFlags.includes("vite:*") || debugFlags.includes("vite:legacy");
  const facadeToLegacyChunkMap = /* @__PURE__ */ new Map();
  const facadeToLegacyPolyfillMap = /* @__PURE__ */ new Map();
  const facadeToModernPolyfillMap = /* @__PURE__ */ new Map();
  const modernPolyfills = /* @__PURE__ */ new Set();
  const legacyPolyfills = /* @__PURE__ */ new Set();
  if (Array.isArray(options.modernPolyfills)) {
    options.modernPolyfills.forEach((i) => {
      modernPolyfills.add(
        i.includes("/") ? `core-js/${i}` : `core-js/modules/${i}.js`
      );
    });
  }
  if (Array.isArray(options.polyfills)) {
    options.polyfills.forEach((i) => {
      if (i.startsWith(`regenerator`)) {
        legacyPolyfills.add(`regenerator-runtime/runtime.js`);
      } else {
        legacyPolyfills.add(
          i.includes("/") ? `core-js/${i}` : `core-js/modules/${i}.js`
        );
      }
    });
  }
  if (Array.isArray(options.additionalLegacyPolyfills)) {
    options.additionalLegacyPolyfills.forEach((i) => {
      legacyPolyfills.add(i);
    });
  }
  const legacyConfigPlugin = {
    name: "vite:legacy-config",
    config(config2, env) {
      if (env.command === "build") {
        if (!config2.build) {
          config2.build = {};
        }
        if (!config2.build.cssTarget) {
          config2.build.cssTarget = "chrome61";
        }
      }
      return {
        define: {
          "import.meta.env.LEGACY": env.command === "serve" || config2.build?.ssr ? false : legacyEnvVarMarker
        }
      };
    }
  };
  const legacyGenerateBundlePlugin = {
    name: "vite:legacy-generate-polyfill-chunk",
    apply: "build",
    async generateBundle(opts, bundle) {
      if (config.build.ssr) {
        return;
      }
      if (!isLegacyBundle(bundle, opts)) {
        if (!modernPolyfills.size) {
          return;
        }
        isDebug && console.log(
          `[@vitejs/plugin-legacy] modern polyfills:`,
          modernPolyfills
        );
        await buildPolyfillChunk(
          config.mode,
          modernPolyfills,
          bundle,
          facadeToModernPolyfillMap,
          config.build,
          "es",
          opts,
          true
        );
        return;
      }
      if (!genLegacy) {
        return;
      }
      if (legacyPolyfills.size || genDynamicFallback) {
        await detectPolyfills(
          `Promise.resolve(); Promise.all();`,
          targets,
          legacyPolyfills
        );
        isDebug && console.log(
          `[@vitejs/plugin-legacy] legacy polyfills:`,
          legacyPolyfills
        );
        await buildPolyfillChunk(
          config.mode,
          legacyPolyfills,
          bundle,
          facadeToLegacyPolyfillMap,
          config.build,
          "iife",
          opts,
          options.externalSystemJS
        );
      }
    }
  };
  const legacyPostPlugin = {
    name: "vite:legacy-post-process",
    enforce: "post",
    apply: "build",
    configResolved(_config) {
      if (_config.build.lib) {
        throw new Error("@vitejs/plugin-legacy does not support library mode.");
      }
      config = _config;
      if (!genLegacy || config.build.ssr) {
        return;
      }
      const getLegacyOutputFileName = (fileNames, defaultFileName = "[name]-legacy.[hash].js") => {
        if (!fileNames) {
          return path__default.posix.join(config.build.assetsDir, defaultFileName);
        }
        return (chunkInfo) => {
          let fileName = typeof fileNames === "function" ? fileNames(chunkInfo) : fileNames;
          if (fileName.includes("[name]")) {
            fileName = fileName.replace("[name]", "[name]-legacy");
          } else {
            fileName = fileName.replace(/(.+)\.(.+)/, "$1-legacy.$2");
          }
          return fileName;
        };
      };
      const createLegacyOutput = (options2 = {}) => {
        return {
          ...options2,
          format: "system",
          entryFileNames: getLegacyOutputFileName(options2.entryFileNames),
          chunkFileNames: getLegacyOutputFileName(options2.chunkFileNames)
        };
      };
      const { rollupOptions } = config.build;
      const { output } = rollupOptions;
      if (Array.isArray(output)) {
        rollupOptions.output = [...output.map(createLegacyOutput), ...output];
      } else {
        rollupOptions.output = [createLegacyOutput(output), output || {}];
      }
    },
    async renderChunk(raw, chunk, opts) {
      if (config.build.ssr) {
        return null;
      }
      if (!isLegacyChunk(chunk, opts)) {
        if (options.modernPolyfills && !Array.isArray(options.modernPolyfills)) {
          await detectPolyfills(raw, { esmodules: !options.modernTargets, ...options.modernTargets }, modernPolyfills);
        }
        const ms = new MagicString__default(raw);
        if (genDynamicFallback && chunk.isEntry) {
          ms.prepend(forceDynamicImportUsage);
        }
        if (raw.includes(legacyEnvVarMarker)) {
          const re = new RegExp(legacyEnvVarMarker, "g");
          let match;
          while (match = re.exec(raw)) {
            ms.overwrite(
              match.index,
              match.index + legacyEnvVarMarker.length,
              `false`
            );
          }
        }
        if (config.build.sourcemap) {
          return {
            code: ms.toString(),
            map: ms.generateMap({ hires: true })
          };
        }
        return {
          code: ms.toString()
        };
      }
      if (!genLegacy) {
        return null;
      }
      opts.__vite_skip_esbuild__ = true;
      opts.__vite_force_terser__ = true;
      opts.__vite_skip_asset_emit__ = true;
      const needPolyfills = options.polyfills !== false && !Array.isArray(options.polyfills);
      const sourceMaps = !!config.build.sourcemap;
      const babel2 = await loadBabel();
      const { code, map } = babel2.transform(raw, {
        babelrc: false,
        configFile: false,
        compact: !!config.build.minify,
        sourceMaps,
        inputSourceMap: sourceMaps ? chunk.map : void 0,
        presets: [
          [
            () => ({
              plugins: [
                recordAndRemovePolyfillBabelPlugin(legacyPolyfills),
                replaceLegacyEnvBabelPlugin(),
                wrapIIFEBabelPlugin()
              ]
            })
          ],
          [
            "env",
            createBabelPresetEnvOptions(targets, {
              needPolyfills,
              ignoreBrowserslistConfig: options.ignoreBrowserslistConfig
            })
          ]
        ]
      });
      if (code)
        return { code, map };
      return null;
    },
    transformIndexHtml(html, { chunk }) {
      if (config.build.ssr)
        return;
      if (!chunk)
        return;
      if (chunk.fileName.includes("-legacy")) {
        facadeToLegacyChunkMap.set(chunk.facadeModuleId, chunk.fileName);
        return;
      }
      const tags = [];
      const htmlFilename = chunk.facadeModuleId?.replace(/\?.*$/, "");
      const modernPolyfillFilename = facadeToModernPolyfillMap.get(
        chunk.facadeModuleId
      );
      if (modernPolyfillFilename) {
        tags.push({
          tag: "script",
          attrs: {
            type: "module",
            crossorigin: true,
            src: toAssetPathFromHtml(
              modernPolyfillFilename,
              chunk.facadeModuleId,
              config
            )
          }
        });
      } else if (modernPolyfills.size) {
        throw new Error(
          `No corresponding modern polyfill chunk found for ${htmlFilename}`
        );
      }
      if (!genLegacy) {
        return { html, tags };
      }
      tags.push({
        tag: "script",
        attrs: { nomodule: true },
        children: safari10NoModuleFix,
        injectTo: "body"
      });
      const legacyPolyfillFilename = facadeToLegacyPolyfillMap.get(
        chunk.facadeModuleId
      );
      if (legacyPolyfillFilename) {
        tags.push({
          tag: "script",
          attrs: {
            nomodule: true,
            crossorigin: true,
            id: legacyPolyfillId,
            src: toAssetPathFromHtml(
              legacyPolyfillFilename,
              chunk.facadeModuleId,
              config
            )
          },
          injectTo: "body"
        });
      } else if (legacyPolyfills.size) {
        throw new Error(
          `No corresponding legacy polyfill chunk found for ${htmlFilename}`
        );
      }
      const legacyEntryFilename = facadeToLegacyChunkMap.get(
        chunk.facadeModuleId
      );
      if (legacyEntryFilename) {
        tags.push({
          tag: "script",
          attrs: {
            nomodule: true,
            crossorigin: true,
            id: legacyEntryId,
            "data-src": toAssetPathFromHtml(
              legacyEntryFilename,
              chunk.facadeModuleId,
              config
            )
          },
          children: systemJSInlineCode,
          injectTo: "body"
        });
      } else {
        throw new Error(
          `No corresponding legacy entry chunk found for ${htmlFilename}`
        );
      }
      if (genDynamicFallback && legacyPolyfillFilename && legacyEntryFilename) {
        tags.push({
          tag: "script",
          attrs: { type: "module" },
          children: detectModernBrowserCode,
          injectTo: "head"
        });
        tags.push({
          tag: "script",
          attrs: { type: "module" },
          children: dynamicFallbackInlineCode,
          injectTo: "head"
        });
      }
      return {
        html,
        tags
      };
    },
    generateBundle(opts, bundle) {
      if (config.build.ssr) {
        return;
      }
      if (isLegacyBundle(bundle, opts)) {
        for (const name in bundle) {
          if (bundle[name].type === "asset") {
            delete bundle[name];
          }
        }
      }
    }
  };
  return [legacyConfigPlugin, legacyGenerateBundlePlugin, legacyPostPlugin];
}
async function detectPolyfills(code, targets, list) {
  const babel2 = await loadBabel();
  const { ast } = babel2.transform(code, {
    ast: true,
    babelrc: false,
    configFile: false,
    presets: [
      [
        "env",
        createBabelPresetEnvOptions(targets, { ignoreBrowserslistConfig: true })
      ]
    ]
  });
  for (const node of ast.program.body) {
    if (node.type === "ImportDeclaration") {
      const source = node.source.value;
      if (source.startsWith("core-js/") || source.startsWith("regenerator-runtime/")) {
        list.add(source);
      }
    }
  }
}
function createBabelPresetEnvOptions(targets, {
  needPolyfills = true,
  ignoreBrowserslistConfig
}) {
  return {
    targets,
    bugfixes: true,
    loose: false,
    modules: false,
    useBuiltIns: needPolyfills ? "usage" : false,
    corejs: needPolyfills ? {
      version: _require("core-js/package.json").version,
      proposals: false
    } : void 0,
    shippedProposals: true,
    ignoreBrowserslistConfig
  };
}
async function buildPolyfillChunk(mode, imports, bundle, facadeToChunkMap, buildOptions, format, rollupOutputOptions, excludeSystemJS) {
  let { minify, assetsDir } = buildOptions;
  minify = minify ? "terser" : false;
  const res = await vite.build({
    mode,
    root: path__default.dirname(node_url.fileURLToPath((typeof document === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : (document.currentScript && document.currentScript.src || new URL('index.cjs', document.baseURI).href)))),
    configFile: false,
    logLevel: "error",
    plugins: [polyfillsPlugin(imports, excludeSystemJS)],
    build: {
      write: false,
      minify,
      assetsDir,
      rollupOptions: {
        input: {
          polyfills: polyfillId
        },
        output: {
          format,
          entryFileNames: rollupOutputOptions.entryFileNames
        }
      }
    },
    esbuild: false,
    optimizeDeps: {
      esbuildOptions: {
        target: "es5"
      }
    }
  });
  const _polyfillChunk = Array.isArray(res) ? res[0] : res;
  if (!("output" in _polyfillChunk))
    return;
  const polyfillChunk = _polyfillChunk.output[0];
  for (const key in bundle) {
    const chunk = bundle[key];
    if (chunk.type === "chunk" && chunk.facadeModuleId) {
      facadeToChunkMap.set(chunk.facadeModuleId, polyfillChunk.fileName);
    }
  }
  bundle[polyfillChunk.fileName] = polyfillChunk;
}
const polyfillId = "\0vite/legacy-polyfills";
function polyfillsPlugin(imports, excludeSystemJS) {
  return {
    name: "vite:legacy-polyfills",
    resolveId(id) {
      if (id === polyfillId) {
        return id;
      }
    },
    load(id) {
      if (id === polyfillId) {
        return [...imports].map((i) => `import "${i}";`).join("") + (excludeSystemJS ? "" : `import "systemjs/dist/s.min.js";`);
      }
    }
  };
}
function isLegacyChunk(chunk, options) {
  return options.format === "system" && chunk.fileName.includes("-legacy");
}
function isLegacyBundle(bundle, options) {
  if (options.format === "system") {
    const entryChunk = Object.values(bundle).find(
      (output) => output.type === "chunk" && output.isEntry
    );
    return !!entryChunk && entryChunk.fileName.includes("-legacy");
  }
  return false;
}
function recordAndRemovePolyfillBabelPlugin(polyfills) {
  return ({ types: t }) => ({
    name: "vite-remove-polyfill-import",
    post({ path: path2 }) {
      path2.get("body").forEach((p) => {
        if (t.isImportDeclaration(p)) {
          polyfills.add(p.node.source.value);
          p.remove();
        }
      });
    }
  });
}
function replaceLegacyEnvBabelPlugin() {
  return ({ types: t }) => ({
    name: "vite-replace-env-legacy",
    visitor: {
      Identifier(path2) {
        if (path2.node.name === legacyEnvVarMarker) {
          path2.replaceWith(t.booleanLiteral(true));
        }
      }
    }
  });
}
function wrapIIFEBabelPlugin() {
  return ({ types: t, template }) => {
    const buildIIFE = template(";(function(){%%body%%})();");
    return {
      name: "vite-wrap-iife",
      post({ path: path2 }) {
        if (!this.isWrapped) {
          this.isWrapped = true;
          path2.replaceWith(t.program(buildIIFE({ body: path2.node.body })));
        }
      }
    };
  };
}
const cspHashes = [
  node_crypto.createHash("sha256").update(safari10NoModuleFix).digest("base64"),
  node_crypto.createHash("sha256").update(systemJSInlineCode).digest("base64"),
  node_crypto.createHash("sha256").update(detectModernBrowserCode).digest("base64"),
  node_crypto.createHash("sha256").update(dynamicFallbackInlineCode).digest("base64")
];

module.exports = viteLegacyPlugin;
module.exports.cspHashes = cspHashes;
module.exports["default"] = viteLegacyPlugin;
module.exports.detectPolyfills = detectPolyfills;