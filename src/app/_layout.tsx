import { Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { AuthProvider, useAuth } from '../contexts/AuthContext'

function RootNavigator() {
  const { session, loading, recovering } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && !recovering}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="conta"
          options={{ headerShown: true, title: 'Minha conta' }}
        />
        <Stack.Screen
          name="conteudos"
          options={{headerShown: true, title: 'Conteúdos'}}
        />
        <Stack.Screen 
          name="questoes" 
          options={{ headerShown: true, title: 'Questões' }}
        />
        <Stack.Screen 
          name="simulados" 
          options={{ headerShown: true, title: 'Simulados' }} 
        />
        <Stack.Screen 
          name="simulado/[id]" 
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen 
          name="simulado/[id]/resultado" 
          options={{ headerShown: false, gestureEnabled: false }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={recovering}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  )
}