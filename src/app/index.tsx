import { useRouter } from 'expo-router'
import { Button, Text, View } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'

export default function Home() {
  const { session } = useAuth()
  const router = useRouter()

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text>Logada como: {session?.user.email}</Text>
      <Button title="Minha conta" onPress={() => router.push('/conta')} />
      <Button title="Conteudos" onPress={() => router.push('/conteudos')} />
      <Button title="Questões" onPress={() => router.push('/questoes')} />
      <Button title="Simulados" onPress={() => router.push('/simulados')} />
      <Button title="Sair" onPress={() => supabase.auth.signOut()} />
    </View>
  )
}