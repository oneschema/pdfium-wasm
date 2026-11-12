// Downloads the pinned bblanchon/pdfium-binaries WASM release, checks its hashes and writes the
// package contents: dist/ (loaders and WASM), licenses/, VERSION and args.gn.
//
//   node scripts/build.mjs [--tarball path/to/pdfium-wasm.tgz]
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const release = JSON.parse(readFileSync(join(root, "release.json"), "utf8"))
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))

const build = release.tag.match(/^chromium\/(\d+)$/)?.[1]
if (!build) throw new Error(`release.json tag must look like chromium/<build>: ${release.tag}`)
if (pkg.version.split(".")[0] !== build) {
  throw new Error(`package.json version ${pkg.version} must start with the Chromium build ${build}`)
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")

function check(name, bytes, expected) {
  const actual = sha256(bytes)
  if (actual !== expected) throw new Error(`${name} SHA-256 is ${actual}, expected ${expected}`)
  console.log(`${name}: SHA-256 ${actual} OK`)
}

const INDEX_JS = `import loadPdfium from "./loader.js";
import { wasmBase64 } from "./wasm.js";

let cached;

export function wasmBinary() {
  if (!cached) {
    if (typeof Uint8Array.fromBase64 === "function") {
      cached = Uint8Array.fromBase64(wasmBase64);
    } else {
      const text = atob(wasmBase64);
      cached = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) cached[i] = text.charCodeAt(i);
    }
  }
  return cached;
}

export default function loadInlinePdfium(options = {}) {
  return loadPdfium({ wasmBinary: wasmBinary(), ...options });
}
`

const LOADER_D_TS = `export type PdfiumModule = Record<string, any> & {
  HEAPU8: Uint8Array
  _malloc(size: number): number
  _free(ptr: number): void
  wasmExports: { malloc(size: number): number; free(ptr: number): void }
}

export type PdfiumOptions = Record<string, unknown> & { wasmBinary?: Uint8Array | ArrayBuffer }

/** Instantiates PDFium. Pass \`wasmBinary\`, or \`locateFile\` in a browser. */
export default function loadPdfium(options?: PdfiumOptions): Promise<PdfiumModule>
`

const INDEX_D_TS = `import type { PdfiumModule, PdfiumOptions } from "./loader.js"
export type { PdfiumModule, PdfiumOptions } from "./loader.js"

/** The PDFium WASM binary, decoded once from the copy embedded in this module. */
export function wasmBinary(): Uint8Array

/** Instantiates PDFium from the embedded WASM, so it needs no file or network access. */
export default function loadInlinePdfium(options?: PdfiumOptions): Promise<PdfiumModule>
`

const tarballArg = process.argv.indexOf("--tarball")
let tarball
if (tarballArg !== -1) {
  tarball = readFileSync(process.argv[tarballArg + 1])
} else {
  const url = `https://github.com/bblanchon/pdfium-binaries/releases/download/${
    encodeURIComponent(release.tag)
  }/pdfium-wasm.tgz`
  console.log(`Downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  tarball = new Uint8Array(await res.arrayBuffer())
}
check("pdfium-wasm.tgz", tarball, release.tarball_sha256)

const work = mkdtempSync(join(tmpdir(), "pdfium-wasm-"))
try {
  writeFileSync(join(work, "pdfium-wasm.tgz"), tarball)
  execFileSync("tar", ["-xzf", "pdfium-wasm.tgz"], { cwd: work })

  const wasm = readFileSync(join(work, "lib/pdfium.wasm"))
  check("lib/pdfium.wasm", wasm, release.wasm_sha256)
  const glue = readFileSync(join(work, "lib/pdfium.js"), "utf8")
  if (!glue.startsWith('var Module=typeof Module!="undefined"?Module:{};')) {
    throw new Error("lib/pdfium.js no longer has the classic Emscripten shape the wrapper expects")
  }

  const dist = join(root, "dist")
  for (const dir of [dist, join(root, "licenses")]) rmSync(dir, { recursive: true, force: true })
  mkdirSync(dist)
  cpSync(join(work, "licenses"), join(root, "licenses"), { recursive: true })
  for (const file of ["VERSION", "args.gn"]) cpSync(join(work, file), join(root, file))
  cpSync(join(work, "LICENSE"), join(root, "licenses/pdfium-binaries.txt"))

  writeFileSync(join(dist, "pdfium.wasm"), wasm)
  writeFileSync(join(dist, "loader.js"), loaderSource(glue))
  writeFileSync(join(dist, "wasm.js"), wasmSource(wasm))
  writeFileSync(join(dist, "index.js"), INDEX_JS)
  writeFileSync(join(dist, "loader.d.ts"), LOADER_D_TS)
  writeFileSync(join(dist, "index.d.ts"), INDEX_D_TS)
  console.log(`Built ${pkg.name}@${pkg.version} from ${release.tag}`)
} finally {
  rmSync(work, { recursive: true, force: true })
}

// The glue is a classic script that picks Node, browser or worker by looking at globals. Shadowing
// `process`, `require` and `window` makes it take the plain path under Node and Deno, so it never
// reads files or fetches: the caller passes `wasmBinary`. `wasmExports.malloc`/`free` are the
// names `@hyzyla/pdfium`'s `PDFiumLibrary.initBase` expects.
function loaderSource(glue) {
  return `// Generated by scripts/build.mjs from bblanchon/pdfium-binaries ${release.tag} lib/pdfium.js.
export default function loadPdfium(options = {}) {
  return new Promise((resolve, reject) => {
    const process = undefined, require = undefined, window = undefined;
    var Module = Object.assign({}, options, { onAbort: reject });
    Module.onRuntimeInitialized = () => {
      Module.wasmExports = { malloc: Module._malloc, free: Module._free };
      resolve(Module);
    };
${glue}
  });
}
`
}

function wasmSource(wasm) {
  return `// Generated by scripts/build.mjs: lib/pdfium.wasm from bblanchon/pdfium-binaries ${release.tag}, base64.
// SHA-256 ${release.wasm_sha256}
export const wasmBase64 = "${wasm.toString("base64")}";
`
}
