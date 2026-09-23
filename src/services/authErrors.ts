// Validações e tradução de erros do Supabase Auth.
// Mantenha a regra de senha igual à configurada no painel do Supabase.

export const SENHA_MIN = 8
export const SENHA_MAX = 72 // limite do bcrypt usado pelo Supabase

export function validarSenha(senha: string): string | null {
  if (senha.length < SENHA_MIN)
    return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`
  if (senha.length > SENHA_MAX)
    return `A senha pode ter no máximo ${SENHA_MAX} caracteres.`
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha))
    return 'Use letras e números na senha.'
  return null
}

export function validarEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? null
    : 'Digite um email válido.'
}

const MENSAGENS: Record<string, string> = {
  invalid_credentials: 'Email ou senha incorretos.',
  email_not_confirmed: 'Confirme seu email antes de entrar. Veja sua caixa de entrada.',
  user_already_exists: 'Este email já está cadastrado.',
  email_exists: 'Este email já está cadastrado.',
  weak_password: `Senha fraca. Use pelo menos ${SENHA_MIN} caracteres, com letras e números.`,
  same_password: 'A nova senha precisa ser diferente da atual.',
  email_address_invalid: 'Email inválido.',
  validation_failed: 'Dados inválidos. Confira os campos.',
  captcha_failed: 'Falha na verificação de segurança. Tente novamente.',
  signup_disabled: 'Novos cadastros estão desativados no momento.',
  otp_expired: 'O link expirou. Peça um novo.',
  over_email_send_rate_limit: 'Muitos emails enviados. Aguarde alguns minutos e tente de novo.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  email_address_not_authorized: 'Não foi possível enviar o email agora. Tente mais tarde.',
  session_expired: 'Sua sessão expirou. Entre novamente.',
  session_not_found: 'Sua sessão expirou. Entre novamente.',
  reauthentication_needed: 'Por segurança, entre novamente para continuar.',
}

export function traduzErro(error: unknown): string {
  const e = error as { code?: string; name?: string; message?: string } | null

  if (e?.code && MENSAGENS[e.code]) return MENSAGENS[e.code]

  // Sem internet / servidor inacessível
  if (
    e?.name === 'AuthRetryableFetchError' ||
    e?.message?.includes('Network request failed')
  )
    return 'Sem conexão. Verifique sua internet e tente de novo.'

  return 'Algo deu errado. Tente novamente.'
}