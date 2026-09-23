// Versão para iOS/Android. Requer: npx expo install react-native-webview
import { WebView } from 'react-native-webview'
import { pdfHtml } from './pdfHtml'

export default function PdfViewer({ url }: { url: string }) {
  return (
    <WebView
      originWhitelist={['*']}
      // baseUrl dá uma origem https à página, necessária para o pdf.js baixar o arquivo
      source={{ html: pdfHtml(url), baseUrl: 'https://localhost' }}
      style={{ flex: 1, backgroundColor: '#2a2d45' }}
      javaScriptEnabled
      domStorageEnabled
    />
  )
}
