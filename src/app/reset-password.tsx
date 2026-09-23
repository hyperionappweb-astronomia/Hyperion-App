import { useState } from 'react'
import { Button, Text, TextInput, View } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import AvisoModal from '../components/AvisoModal'

type Aviso = { titulo: string; mensagem: string; tipo?: 'aviso' | 'erro' }

export default function ResetPassword() {
  const { finishRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Um popup só, reaproveitado por toda a tela (Alert.alert não aparece na web)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  function avisar(titulo: string, mensagem: string, tipo: 'aviso' | 'erro' = 'erro') {
    setAviso({ titulo, mensagem, tipo })
  }

  async function salvar() {
    if (password.length < 6) return avisar('Erro', 'A senha precisa ter ao menos 6 caracteres.')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return avisar('Erro', error.message)
    avisar('Pronto', 'Senha atualizada!', 'aviso')
    finishRecovery() // libera a home
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text>Digite sua nova senha</Text>
      <TextInput
        placeholder="Nova senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, padding: 10 }}
      />
      <Button title="Salvar" onPress={salvar} disabled={loading} />

      <AvisoModal
        visible={!!aviso}
        titulo={aviso?.titulo ?? ''}
        mensagem={aviso?.mensagem ?? ''}
        tipo={aviso?.tipo}
        onFechar={() => setAviso(null)}
      />
    </View>
  )
}
