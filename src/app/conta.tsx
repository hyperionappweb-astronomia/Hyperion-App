import { FunctionsHttpError } from '@supabase/supabase-js'
import * as Linking from 'expo-linking'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { traduzErro, validarEmail } from '../services/authErrors'
import { supabase } from '../services/supabase'
import { useCaptcha } from '../services/useCaptcha'

export default function Conta() {
  const { session } = useAuth()
  const user = session?.user
  const { comCaptcha, captchaView } = useCaptcha()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState(user?.email ?? '')
  const [carregando, setCarregando] = useState(true)
  const [loading, setLoading] = useState(false)
  const [excluindo, setExcluindo] = useState(false) // painel de confirmação aberto
  const [senhaExclusao, setSenhaExclusao] = useState('')

  // Carrega o nome da tabela aluno
  useEffect(() => {
    if (!user) return
    supabase
      .from('aluno')
      .select('nome')
      .eq('id_aluno', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) Alert.alert('Erro', error.message)
        else setNome(data.nome)
        setCarregando(false)
      })
  }, [user?.id])

  async function salvarNome() {
    const novo = nome.trim()
    if (!novo) return Alert.alert('Erro', 'Digite um nome.')
    setLoading(true)
    const { error } = await supabase
      .from('aluno')
      .update({ nome: novo })
      .eq('id_aluno', user!.id)
    setLoading(false)
    if (error) Alert.alert('Erro', error.message)
    else Alert.alert('Pronto', 'Nome atualizado!')
  }

  async function salvarEmail() {
    const novo = email.trim().toLowerCase()
    const erroEmail = validarEmail(novo)
    if (erroEmail) return Alert.alert('Erro', erroEmail)
    if (novo === user?.email) return

    setLoading(true)
    const { error } = await supabase.auth.updateUser(
      { email: novo },
      { emailRedirectTo: Linking.createURL('') }
    )
    setLoading(false)
    if (error) Alert.alert('Erro', traduzErro(error))
    else
      Alert.alert(
        'Confirme a troca',
        'Enviamos um link de confirmação. Abra o email (confira também o email atual) para concluir a troca. Até lá, o email antigo continua valendo.'
      )
  }

  function cancelarExclusao() {
    setExcluindo(false)
    setSenhaExclusao('')
  }

  async function excluir() {
    if (!senhaExclusao) return Alert.alert('Erro', 'Digite sua senha para confirmar.')

    setLoading(true)
    const captcha = await comCaptcha()
    if (!captcha.ok) return setLoading(false)

    // A senha é conferida no servidor, dentro da edge function
    const { error } = await supabase.functions.invoke('delete-account', {
      body: { password: senhaExclusao, captchaToken: captcha.token },
    })

    if (error) {
      setLoading(false)
      let code: string | undefined
      if (error instanceof FunctionsHttpError) {
        try {
          code = (await error.context.json())?.code
        } catch {}
      }
      return Alert.alert(
        'Erro',
        code === 'invalid_credentials'
          ? 'Senha incorreta.'
          : code
            ? traduzErro({ code })
            : 'Não foi possível excluir a conta. Tente novamente.'
      )
    }

    // O usuário já não existe no servidor: sai só localmente.
    // O onAuthStateChange zera a sessão e o layout leva para o login.
    await supabase.auth.signOut({ scope: 'local' })
  }

  if (carregando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 24, gap: 12 }}
    >
      <Text>Nome</Text>
      <TextInput
        value={nome}
        onChangeText={setNome}
        maxLength={100}
        style={{ borderWidth: 1, padding: 10 }}
      />
      <Button title="Salvar nome" onPress={salvarNome} disabled={loading} />

      <Text style={{ marginTop: 16 }}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={{ borderWidth: 1, padding: 10 }}
      />
      <Button title="Salvar email" onPress={salvarEmail} disabled={loading} />

      <View style={{ marginTop: 32, gap: 12 }}>
        {!excluindo ? (
          <Button
            title="Excluir minha conta"
            color="red"
            onPress={() => setExcluindo(true)}
            disabled={loading}
          />
        ) : (
          <>
            <Text style={{ color: 'red', fontWeight: 'bold' }}>
              Isso apaga sua conta e todo o seu histórico de simulados. Não dá para
              desfazer.
            </Text>
            <Text>Digite sua senha para confirmar:</Text>
            <TextInput
              placeholder="Senha"
              value={senhaExclusao}
              onChangeText={setSenhaExclusao}
              secureTextEntry
              autoCapitalize="none"
              style={{ borderWidth: 1, padding: 10 }}
            />
            <Button
              title="Confirmar exclusão"
              color="red"
              onPress={excluir}
              disabled={loading}
            />
            <Button title="Cancelar" onPress={cancelarExclusao} disabled={loading} />
          </>
        )}
      </View>

      {captchaView}
    </ScrollView>
  )
}
