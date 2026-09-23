// Salve como services/useCaptcha.tsx
import { useRef } from 'react'
import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha'

// Se essa variável não existir no .env, o CAPTCHA fica desligado no app.
const HCAPTCHA_SITEKEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITEKEY

// Uso:
//   const { comCaptcha, captchaView } = useCaptcha()
//   const c = await comCaptcha()          // { ok: false } se cancelado
//   ... options: { captchaToken: c.token }
//   e renderize {captchaView} em algum lugar da tela
export function useCaptcha() {
  const ref = useRef<any>(null)
  const resolver = useRef<((t: string | null) => void) | null>(null)

  // undefined = captcha desligado | null = cancelado/falhou | string = token
  function obter(): Promise<string | null | undefined> {
    if (!HCAPTCHA_SITEKEY) return Promise.resolve(undefined)
    return new Promise((resolve) => {
      resolver.current = resolve
      ref.current?.show()
    })
  }

  function onMessage(event: any) {
    const dado = event?.nativeEvent?.data
    if (!dado || dado === 'open') return
    ref.current?.hide()
    if (event.success) {
      resolver.current?.(dado)
      event.markUsed?.()
    } else {
      resolver.current?.(null)
    }
    resolver.current = null
  }

  // undefined = captcha desligado | null = cancelado/falhou | string = token
  // Não mostra nenhum aviso aqui -- quem chamar decide como avisar a pessoa.
  async function comCaptcha(): Promise<{ ok: boolean; token?: string }> {
    const token = await obter()
    if (token === null) return { ok: false }
    return { ok: true, token }
  }

  const captchaView = HCAPTCHA_SITEKEY ? (
    <ConfirmHcaptcha
      ref={ref}
      siteKey={HCAPTCHA_SITEKEY}
      baseUrl="https://hcaptcha.com"
      languageCode="pt"
      size="invisible"
      onMessage={onMessage}
    />
  ) : null

  return { comCaptcha, captchaView }
}
