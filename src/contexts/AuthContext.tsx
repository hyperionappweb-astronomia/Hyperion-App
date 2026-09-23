import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import * as Linking from 'expo-linking'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

type AuthContextType = {
  session: Session | null
  loading: boolean
  recovering: boolean
  finishRecovery: () => void
}
  
const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  recovering: false,
  finishRecovery: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) setRecovering(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Links vindos do email: redefinição de senha e confirmação de troca de email
  useEffect(() => {
    async function handleUrl(url: string | null) {
      if (!url) return
      const isRecovery = url.includes('type=recovery')
      const isEmailChange = url.includes('type=email_change')
      if (!isRecovery && !isEmailChange) return

      const params = new URLSearchParams(url.split('#')[1] ?? '')
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (!access_token || !refresh_token) return

      if (isRecovery) setRecovering(true)
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })
      if (error && isRecovery) setRecovering(false)
    }

    Linking.getInitialURL().then(handleUrl)
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => sub.remove()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        recovering,
        finishRecovery: () => setRecovering(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)