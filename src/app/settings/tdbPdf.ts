import { pdfTokensToRows } from './tdbParse'

/** TDB tarife PDF'sinin metin katmanını okuyup tablo satırlarına çevirir (tarayıcıda, pdf.js ile). */
export async function readTdbPdf(file: File): Promise<(string | null)[][]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const tokens: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent()
    for (const item of content.items) if ('str' in item) tokens.push(item.str)
  }
  return pdfTokensToRows(tokens)
}
