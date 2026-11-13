// Points release.json and package.json at another bblanchon/pdfium-binaries release.
//
//   node scripts/update.mjs chromium/<build>
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const tag = process.argv[2]
const build = tag?.match(/^chromium\/(\d+)$/)?.[1]
if (!build) throw new Error("usage: node scripts/update.mjs chromium/<build>")

const root = fileURLToPath(new URL("..", import.meta.url))
const url = `https://github.com/bblanchon/pdfium-binaries/releases/download/${
  encodeURIComponent(tag)
}/pdfium-wasm.tgz`
const res = await fetch(url)
if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
const tarball = new Uint8Array(await res.arrayBuffer())
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")

const work = mkdtempSync(join(tmpdir(), "pdfium-wasm-"))
try {
  writeFileSync(join(work, "pdfium-wasm.tgz"), tarball)
  execFileSync("tar", ["-xzf", "pdfium-wasm.tgz", "lib/pdfium.wasm"], { cwd: work })
  const release = {
    tag,
    tarball_sha256: sha256(tarball),
    wasm_sha256: sha256(readFileSync(join(work, "lib/pdfium.wasm"))),
  }
  writeFileSync(join(root, "release.json"), JSON.stringify(release, null, 2) + "\n")
  console.log(release)
} finally {
  rmSync(work, { recursive: true, force: true })
}

const pkgPath = join(root, "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
pkg.version = `${build}.0.0`
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
console.log(`package.json version ${pkg.version}`)
