# @oneschema/pdfium-wasm

[PDFium](https://pdfium.googlesource.com/pdfium/) compiled to WebAssembly, republished from the weekly [bblanchon/pdfium-binaries](https://github.com/bblanchon/pdfium-binaries) `pdfium-wasm.tgz` release as an ES module.

```ts
import loadPdfium from "@oneschema/pdfium-wasm"

const pdfium = await loadPdfium() // instantiates the embedded WASM: no file or network access
pdfium._FPDF_InitLibrary()
```

- `@oneschema/pdfium-wasm` (default export): loads the WASM embedded in `dist/wasm.js` as base64. It needs no file or network access.
- `@oneschema/pdfium-wasm/loader`: the same loader without the embedded copy; pass `{ wasmBinary }` yourself, for example the bytes of `@oneschema/pdfium-wasm/pdfium.wasm`.
- The resolved module is the Emscripten module: PDFium's C API as `_FPDF_*` functions plus `HEAPU8`, `_malloc` and `_free`. It also sets `wasmExports.malloc`/`free`, so it can be passed to `@hyzyla/pdfium`'s `PDFiumLibrary.initBase({ vendor })`.

## What the build does

`scripts/build.mjs` downloads the release named in `release.json`, checks the tarball's and `lib/pdfium.wasm`'s SHA-256 against `release.json`, and writes `dist/`, `licenses/`, `VERSION` and `args.gn`. `lib/pdfium.wasm` and `lib/pdfium.js` are used unmodified: the loader is `lib/pdfium.js` wrapped in an ES-module function that shadows `process`, `require` and `window`, so the glue never takes its Node `require("fs")` or browser `fetch` path.

## Versions

The version is `<Chromium build>.<package revision>.0`: `8152.0.0` is PDFium `chromium/8152` (`159.0.8152.0`), and a wrapper-only fix on the same build would be `8152.1.0`. The build fails if the major version does not match `release.json`'s tag.

## Updating PDFium

```sh
node scripts/update.mjs chromium/<build>   # downloads the release, records its hashes, sets the version
node scripts/build.mjs && deno task test   # tests run under Deno
```

Open a PR with the `release.json` and `package.json` changes. Merging to `main` publishes the new version to npm through trusted publishing with provenance (`.github/workflows/release.yml`).

## Licenses

See [LICENSE.md](LICENSE.md).
