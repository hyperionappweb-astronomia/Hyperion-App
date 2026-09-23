import { useState } from 'react'
import { Alert, Button, Text, TextInput, View } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'

export default function ResetPassword() {
  const { finishRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function salvar() {
    if (password.length < 6)
      return Alert.alert('Erro', 'A senha precisa ter ao menos 6 caracteres.')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return Alert.alert('Erro', error.message)
    Alert.alert('Pronto', 'Senha atualizada!')
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
    </View>
  )
}