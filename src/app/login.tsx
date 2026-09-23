import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha'
import * as Linking from 'expo-linking'
import { useRef, useState } from 'react'
import { Button, ScrollView, Text, TextInput } from 'react-native'
import AvisoModal from '../components/AvisoModal'
import {
  SENHA_MIN,
  traduzErro,
  validarEmail,
  validarSenha,
} from '../services/authErrors'
import { supabase } from '../services/supabase'

// Se essa variável não existir no .env, o CAPTCHA fica desligado no app.
// Ative no app e no painel do Supabase AO MESMO TEMPO (ver instruções).
const HCAPTCHA_SITEKEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITEKEY

type Aviso = { titulo: string; mensagem: string; tipo?: 'aviso' | 'erro' }

export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Um popup só, reaproveitado por toda a tela (Alert.alert não aparece na web)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  function avisar(titulo: string, mensagem: string, tipo: 'aviso' | 'erro' = 'erro') {
    setAviso({ titulo, mensagem, tipo })
  }

  // ---------- CAPTCHA (invisível; só aparece desafio se necessário) ----------
  const captchaRef = useRef<any>(null)
  const captchaResolve = useRef<((t: string | null) => void) | null>(null)

  // undefined = captcha desligado | null = cancelado/falhou | string = token
  function obterCaptcha(): Promise<string | null | undefined> {
    if (!HCAPTCHA_SITEKEY) return Promise.resolve(undefined)
    return new Promise((resolve) => {
      captchaResolve.current = resolve
      captchaRef.current?.show()
    })
  }

  function onCaptchaMessage(event: any) {
    const dado = event?.nativeEvent?.data
    if (!dado || dado === 'open') return
    captchaRef.current?.hide()
    if (event.success) {
      captchaResolve.current?.(dado)
      event.markUsed?.()
    } else {
      captchaResolve.current?.(null)
    }
    captchaResolve.current = null
  }

  // Pede o captcha; se foi cancelado, avisa e devolve null
  async function comCaptcha(): Promise<{ ok: boolean; token?: string }> {
    const token = await obterCaptcha()
    if (token === null) {
      avisar('Erro', 'Verificação de segurança não concluída. Tente novamente.')
      return { ok: false }
    }
    return { ok: true, token }
  }

  // ---------- Ações ----------
  async function entrar() {
    const erroEmail = validarEmail(email)
    if (erroEmail) return avisar('Erro', erroEmail)
    if (!password) return avisar('Erro', 'Digite sua senha.')

    setLoading(true)
    const captcha = await comCaptcha()
    if (!captcha.ok) return setLoading(false)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
      options: { captchaToken: captcha.token },
    })
    if (error) avisar('Erro', traduzErro(error))
    setLoading(false)
  }

  async function cadastrar() {
    const nomeLimpo = nome.trim()
    if (!nomeLimpo) return avisar('Erro', 'Digite seu nome.')
    const erro = validarEmail(email) ?? validarSenha(password)
    if (erro) return avisar('Erro', erro)

    setLoading(true)
    const captcha = await comCaptcha()
    if (!captcha.ok) return setLoading(false)

    const emailLimpo = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signUp({
      email: emailLimpo,
      password,
      options: { data: { nome: nomeLimpo }, captchaToken: captcha.token },
    })
    if (error) avisar('Erro', traduzErro(error))
    else if (!data.session)
      avisar(
        'Confirme seu email',
        `Enviamos um link de confirmação para ${emailLimpo}. Você precisa clicar nele antes de conseguir entrar.`,
        'aviso'
      )
    setLoading(false)
  }

  async function esqueciSenha() {
    const erroEmail = validarEmail(email)
    if (erroEmail) return avisar('Erro', 'Digite seu email primeiro.')

    setLoading(true)
    const captcha = await comCaptcha()
    if (!captcha.ok) return setLoading(false)

    const redirectTo = Linking.createURL('')
    if (__DEV__) console.log('redirectTo:', redirectTo)

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo, captchaToken: captcha.token }
    )
    if (error) avisar('Erro', traduzErro(error))
    else
      avisar(
        'Verifique seu email',
        'Se esse email estiver cadastrado, enviaremos um link para redefinir a senha.',
        'aviso'
      )
    setLoading(false)
  }

  // ---------- Tela ----------
  const cadastrando = modo === 'cadastrar'

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: 'bold' }}>
        {cadastrando ? 'Criar conta' : 'Entrar'}
      </Text>

      {cadastrando && (
        <TextInput
          placeholder="Nome"
          value={nome}
          onChangeText={setNome}
          maxLength={100}
          autoCapitalize="words"
          style={{ borderWidth: 1, padding: 10 }}
        />
      )}
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={{ borderWidth: 1, padding: 10 }}
      />
      <TextInput
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, padding: 10 }}
      />
      {cadastrando && (
        <Text>Mínimo de {SENHA_MIN} caracteres, com letras e números.</Text>
      )}

      {cadastrando ? (
        <>
          <Button title="Criar conta" onPress={cadastrar} disabled={loading} />
          <Button
            title="Já tenho conta"
            onPress={() => setModo('entrar')}
            disabled={loading}
          />
        </>
      ) : (
        <>
          <Button title="Entrar" onPress={entrar} disabled={loading} />
          <Button
            title="Criar conta nova"
            onPress={() => setModo('cadastrar')}
            disabled={loading}
          />
          <Button
            title="Esqueci minha senha"
            onPress={esqueciSenha}
            disabled={loading}
          />
        </>
      )}

      {HCAPTCHA_SITEKEY ? (
        <ConfirmHcaptcha
          ref={captchaRef}
          siteKey={HCAPTCHA_SITEKEY}
          baseUrl="https://hcaptcha.com"
          languageCode="pt"
          size="invisible"
          onMessage={onCaptchaMessage}
        />
      ) : null}

      <AvisoModal
        visible={!!aviso}
        titulo={aviso?.titulo ?? ''}
        mensagem={aviso?.mensagem ?? ''}
        tipo={aviso?.tipo}
        onFechar={() => setAviso(null)}
      />
    </ScrollView>
  )
}
