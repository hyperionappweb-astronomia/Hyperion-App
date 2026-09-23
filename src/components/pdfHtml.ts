// Gera a página HTML que desenha o PDF com pdf.js.
// É a mesma para web (iframe) e celular (WebView), então o resultado é igual nas duas.
// Requer internet para carregar o pdf.js do cdnjs.

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174'

export function pdfHtml(url: string): string {
  // JSON.stringify protege a URL; o replace impede "</script>" de fechar o bloco
  const u = JSON.stringify(url).replace(/</g, '\\u003c')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">
<style>
  html, body { margin: 0; background: #2a2d45; font-family: system-ui, sans-serif; }
  #msg { color: #e6e8f5; text-align: center; padding: 28px 16px; }
  canvas { display: block; margin: 10px auto; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.45); }
</style>
<script src="${PDFJS}/pdf.min.js"></script>
</head>
<body>
<div id="msg">Carregando PDF…</div>
<div id="pages"></div>
<script>
(async () => {
  const msg = document.getElementById('msg')
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.js'
    // isEvalSupported: false evita execução de código embutido em PDFs maliciosos
    const pdf = await pdfjsLib.getDocument({ url: ${u}, isEvalSupported: false }).promise
    const box = document.getElementById('pages')
    const largura = Math.min(document.documentElement.clientWidth - 20, 900)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const escala = largura / base.width
      const vp = page.getViewport({ scale: escala * dpr })
      const canvas = document.createElement('canvas')
      canvas.width = vp.width
      canvas.height = vp.height
      canvas.style.width = (vp.width / dpr) + 'px'
      canvas.style.height = (vp.height / dpr) + 'px'
      box.appendChild(canvas)
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
      if (n === 1) msg.remove()
    }
  } catch (e) {
    msg.textContent = 'Não foi possível abrir o PDF. Verifique a conexão e tente de novo.'
  }
})()
</script>
</body>
</html>`
}
