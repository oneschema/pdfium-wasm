// Runs with read access to test/ and release.json only, so the loaders must not read
// dist/pdfium.wasm or any other file.
import { assert, assertEquals, assertRejects } from "@std/assert"
import loadInlinePdfium, { wasmBinary } from "../dist/index.js"
import loadPdfium from "../dist/loader.js"

// A two-page 144x72 pt PDF: page 1 has a 36 pt black square at (72, 18). The xref offsets are
// computed so PDFium does not need to rebuild the table.
function samplePdf(): Uint8Array {
  const content = "0 0 0 rg 72 18 36 36 re f"
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 144 72] /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 144 72] >>",
  ]
  let pdf = "%PDF-1.7\n"
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

// deno-lint-ignore no-explicit-any
function openDocument(m: any, bytes: Uint8Array) {
  const ptr = m._malloc(bytes.length)
  m.HEAPU8.set(bytes, ptr)
  const doc = m._FPDF_LoadMemDocument(ptr, bytes.length, 0)
  return { doc, close: () => (doc && m._FPDF_CloseDocument(doc), m._free(ptr)) }
}

Deno.test("the embedded WASM is the pinned release", async () => {
  const release = JSON.parse(await Deno.readTextFile(new URL("../release.json", import.meta.url)))
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", wasmBinary()))
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")
  assertEquals(hex, release.wasm_sha256)
})

Deno.test("renders a page from the embedded WASM", async () => {
  const m = await loadInlinePdfium()
  m._FPDF_InitLibrary()
  assertEquals(m.wasmExports.malloc, m._malloc)
  assertEquals(typeof m._FPDFPageObj_GetRenderedFillPattern, "function")

  const { doc, close } = openDocument(m, samplePdf())
  assert(doc, "FPDF_LoadMemDocument failed")
  assertEquals(m._FPDF_GetPageCount(doc), 2)

  const page = m._FPDF_LoadPage(doc, 0)
  const [w, h] = [144, 72]
  const bitmap = m._FPDFBitmap_Create(w, h, 0)
  m._FPDFBitmap_FillRect(bitmap, 0, 0, w, h, 0xffffffff)
  m._FPDF_RenderPageBitmap(bitmap, page, 0, 0, w, h, 0, 0)
  const buf = m._FPDFBitmap_GetBuffer(bitmap)
  const stride = m._FPDFBitmap_GetStride(bitmap)
  const pixel = (x: number, y: number) =>
    m.HEAPU8.slice(buf + y * stride + x * 4, buf + y * stride + x * 4 + 3)
  assertEquals(Array.from(pixel(90, 36)), [0, 0, 0])
  assertEquals(Array.from(pixel(10, 10)), [255, 255, 255])
  m._FPDFBitmap_Destroy(bitmap)
  m._FPDF_ClosePage(page)
  close()
})

Deno.test("rejects bytes that are not a PDF", async () => {
  const m = await loadInlinePdfium()
  m._FPDF_InitLibrary()
  const { doc, close } = openDocument(m, new TextEncoder().encode("not a pdf"))
  assertEquals(doc, 0)
  assertEquals(m._FPDF_GetLastError(), 3) // FPDF_ERR_FORMAT
  close()
})

Deno.test("the plain loader takes wasmBinary and never reads files", async () => {
  const m = await loadPdfium({ wasmBinary: wasmBinary() })
  m._FPDF_InitLibrary()
  assertEquals(typeof m._FPDF_LoadMemDocument, "function")
  await assertRejects(
    () => Deno.readFile(new URL("../dist/pdfium.wasm", import.meta.url)),
    Deno.errors.NotCapable,
  )
})
