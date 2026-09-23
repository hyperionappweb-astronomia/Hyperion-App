// Versão para navegador (o Metro escolhe este arquivo no web automaticamente).
import { createElement } from 'react'
import { pdfHtml } from './pdfHtml'

export default function PdfViewer({ url }: { url: string }) {
  return createElement('iframe', {
    srcDoc: pdfHtml(url),
    title: 'Visualizador de PDF',
    style: { flex: 1, width: '100%', height: '100%', border: 'none' },
  })
}
