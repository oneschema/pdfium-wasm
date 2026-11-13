# Licenses

The wrapper code in this package (`scripts/`, `test/`, and the parts of `dist/` that `scripts/build.mjs` writes around the upstream files) is MIT licensed:

> Copyright (c) 2026 OneSchema, Inc.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

`dist/pdfium.wasm`, its base64 copy in `dist/wasm.js`, and the Emscripten glue inside `dist/loader.js` are PDFium and its third-party libraries, built by [bblanchon/pdfium-binaries](https://github.com/bblanchon/pdfium-binaries). Their notices ship unmodified in `licenses/`, copied from the release tarball: `pdfium.txt` for PDFium itself, `pdfium-binaries.txt` for the build project, and one file per bundled library (Abseil, AGG, Dragonbox, fast_float, FreeType, HarfBuzz, Highway, ICU, Little CMS, libjpeg-turbo, OpenJPEG, libpng, simdutf, zlib).
