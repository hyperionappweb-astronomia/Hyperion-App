import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Button,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as Linking from 'expo-linking'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import { SENHA_MIN, traduzErro, validarEmail, validarSenha } from '../services/authErrors'
import { useCaptcha } from '../services/useCaptcha'
import AvisoModal from '../components/AvisoModal'

type Tentativa = {
  id_resultado: number
  pontuacao_obtida: number | null
  tempo_gasto: string | null
  data_fim: string | null
  simulado: {
    titulo: string | null
    quantidade_questoes: number | null
    nivel: { codigo_nivel: string } | null
  } | null
}

type Aviso = { titulo: string; mensagem: string; tipo?: 'aviso' | 'erro' }

const COR = {
  fundo: '#f4f5f9',
  tinta: '#1c2050',
  borda: '#d3d7e6',
  suave: '#5b6080',
  erro: '#b3261e',
  acerto: '#1e7d32',
  cartao: '#fff',
}

// "01:23:45" -> segundos
function paraSegundos(hms: string) {
  const [h, m, s] = hms.split(':').map(Number)
  return h * 3600 + m * 60 + (s || 0)
}

// segundos -> "1h 23min" ou "8 min"
function formatarDuracao(segundos: number) {
  const h = Math.floor(segundos / 3600)
  const m = Math.round((segundos % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m} min`
}

function formatarData(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR')
}

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

  // ---------- Troca de senha ----------
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaNovaConfirma, setSenhaNovaConfirma] = useState('')
  const trocandoSenhaRef = useRef(false) // trava contra clique duplo

  // Um popup só, reaproveitado por toda a tela (Alert.alert não aparece na web)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  function avisar(titulo: string, mensagem: string, tipo: 'aviso' | 'erro' = 'erro') {
    setAviso({ titulo, mensagem, tipo })
  }

  // ---------- Estatísticas de simulados ----------
  const [tentativas, setTentativas] = useState<Tentativa[]>([])
  const [carregandoEstatisticas, setCarregandoEstatisticas] = useState(true)
  const [erroEstatisticas, setErroEstatisticas] = useState<string | null>(null)

  useEffect(() => {
    if (user?.email) setEmail(user.email)
  }, [user?.email])

  // Carrega o nome da tabela aluno
  useEffect(() => {
    if (!user) return
    supabase
      .from('aluno')
      .select('nome')
      .eq('id_aluno', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) avisar('Erro', error.message)
        else setNome(data.nome)
        setCarregando(false)
      })
  }, [user?.id])

  // Carrega os simulados já concluídos
  useEffect(() => {
    if (!user) return
    supabase
      .from('resultado_simulado')
      .select(
        'id_resultado, pontuacao_obtida, tempo_gasto, data_fim, simulado(titulo, quantidade_questoes, nivel(codigo_nivel))'
      )
      .eq('status', 'CONCLUIDO')
      .order('data_fim', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) setErroEstatisticas('Não foi possível carregar seus simulados.')
        else setTentativas((data as unknown as Tentativa[]) ?? [])
        setCarregandoEstatisticas(false)
      })
  }, [user?.id])

  const taxaAcertoGeral = useMemo(() => {
    if (tentativas.length === 0) return null
    const soma = tentativas.reduce((acc, t) => acc + (t.pontuacao_obtida ?? 0), 0)
    return soma / tentativas.length
  }, [tentativas])

  const tempoMedio = useMemo(() => {
    const comTempo = tentativas.filter((t) => t.tempo_gasto)
    if (comTempo.length === 0) return null
    const soma = comTempo.reduce((acc, t) => acc + paraSegundos(t.tempo_gasto!), 0)
    return soma / comTempo.length
  }, [tentativas])

  async function salvarNome() {
    const novo = nome.trim()
    if (!novo) return avisar('Erro', 'Digite um nome.')
    setLoading(true)
    const { error } = await supabase
      .from('aluno')
      .update({ nome: novo })
      .eq('id_aluno', user!.id)
    setLoading(false)
    if (error) avisar('Erro', error.message)
    else avisar('Pronto', 'Nome atualizado!', 'aviso')
  }

  async function salvarEmail() {
    const novo = email.trim().toLowerCase()
    const erroEmail = validarEmail(novo)
    if (erroEmail) return avisar('Erro', erroEmail)
    if (novo === user?.email) return

    setLoading(true)
    const { error } = await supabase.auth.updateUser(
      { email: novo },
      { emailRedirectTo: Linking.createURL('') }
    )
    setLoading(false)
    if (error) avisar('Erro', traduzErro(error))
    else
      avisar(
        'Confirme a troca',
        'Enviamos um link de confirmação. Abra o email (confira também o email atual) para concluir a troca. Até lá, o email antigo continua valendo.',
        'aviso'
      )
  }

  async function trocarSenha() {
    if (trocandoSenhaRef.current) return // já tem uma troca em andamento
    if (!senhaAtual) return avisar('Erro', 'Digite sua senha atual.')

    const erroSenha = validarSenha(senhaNova)
    if (erroSenha) return avisar('Erro', erroSenha)
    if (senhaNova !== senhaNovaConfirma)
      return avisar('Erro', 'As senhas novas não são iguais.')
    if (senhaNova === senhaAtual)
      return avisar('Erro', 'A nova senha precisa ser diferente da atual.')

    trocandoSenhaRef.current = true
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        current_password: senhaAtual,
        password: senhaNova,
      } as { current_password: string; password: string }) // campo novo, ainda sem tipo no SDK
      if (error) {
        const codigo = (error as { code?: string }).code
        return avisar(
          'Erro',
          codigo === 'invalid_credentials' ? 'Senha atual incorreta.' : traduzErro(error)
        )
      }

      setSenhaAtual('')
      setSenhaNova('')
      setSenhaNovaConfirma('')
      avisar('Pronto', 'Senha atualizada!', 'aviso')
    } finally {
      trocandoSenhaRef.current = false
      setLoading(false)
    }
  }

  function cancelarExclusao() {
    setExcluindo(false)
    setSenhaExclusao('')
  }

  async function excluir() {
    if (!senhaExclusao) return avisar('Erro', 'Digite sua senha para confirmar.')

    setLoading(true)
    const captcha = await comCaptcha()
    if (!captcha.ok) {
      avisar('Erro', 'Verificação de segurança não concluída. Tente novamente.')
      return setLoading(false)
    }

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
      return avisar(
        'Erro',
        code === 'invalid_credentials'
          ? 'Senha incorreta.'
          : code
            ? traduzErro({ code })
            : 'Não foi possível excluir a conta. Tente novamente.'
      )
    }

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
      contentContainerStyle={{ padding: 24, gap: 12, backgroundColor: COR.fundo }}
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

      <Text style={{ marginTop: 32, fontSize: 17, fontWeight: '700', color: COR.tinta }}>
        Trocar senha
      </Text>
      <TextInput
        placeholder="Senha atual"
        value={senhaAtual}
        onChangeText={setSenhaAtual}
        secureTextEntry
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 10 }}
      />
      <TextInput
        placeholder="Senha nova"
        value={senhaNova}
        onChangeText={setSenhaNova}
        secureTextEntry
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 10 }}
      />
      <TextInput
        placeholder="Senha nova de novo"
        value={senhaNovaConfirma}
        onChangeText={setSenhaNovaConfirma}
        secureTextEntry
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 10 }}
      />
      <Text style={{ color: COR.suave, fontSize: 13 }}>
        Mínimo de {SENHA_MIN} caracteres, com letras e números.
      </Text>
      <Button title="Salvar senha nova" onPress={trocarSenha} disabled={loading} />

      {/* ---------- Estatísticas (uma sessão embaixo da outra) ---------- */}
      <Text style={{ marginTop: 32, fontSize: 17, fontWeight: '700', color: COR.tinta }}>
        Seu desempenho
      </Text>

      {carregandoEstatisticas ? (
        <ActivityIndicator />
      ) : erroEstatisticas ? (
        <Text style={{ color: COR.erro }}>{erroEstatisticas}</Text>
      ) : tentativas.length === 0 ? (
        <Text style={{ color: COR.suave }}>
          Você ainda não concluiu nenhum simulado.
        </Text>
      ) : (
        <View style={{ gap: 16 }}>
          {/* Sessão 1: simulados já realizados */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '700', color: COR.tinta }}>
              Simulados realizados
            </Text>
            <View style={{ gap: 8 }}>
              {tentativas.map((t) => (
                <View
                  key={t.id_resultado}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: COR.borda,
                    backgroundColor: COR.cartao,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: COR.tinta, fontWeight: '600' }}>
                    {t.simulado?.nivel?.codigo_nivel
                      ? `Nível ${t.simulado.nivel.codigo_nivel}`
                      : 'Simulado'}
                    {t.simulado?.quantidade_questoes
                      ? ` · ${t.simulado.quantidade_questoes} questões`
                      : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: COR.suave, fontSize: 13 }}>
                      {formatarData(t.data_fim)}
                    </Text>
                    <Text style={{ color: COR.suave, fontSize: 13 }}>
                      {t.tempo_gasto ? formatarDuracao(paraSegundos(t.tempo_gasto)) : '—'}
                    </Text>
                  </View>
                  <Text style={{ color: COR.tinta, fontWeight: '700' }}>
                    {(t.pontuacao_obtida ?? 0).toFixed(0)}% de acerto
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Sessão 2: taxa de acerto geral */}
          <View
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: '#eef0fb',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ color: COR.suave }}>Taxa de acerto geral</Text>
            <Text style={{ fontSize: 28, fontWeight: '700', color: COR.tinta }}>
              {taxaAcertoGeral !== null ? `${taxaAcertoGeral.toFixed(0)}%` : '—'}
            </Text>
          </View>

          {/* Sessão 3: tempo médio de conclusão */}
          <View
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: '#eef0fb',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ color: COR.suave }}>Tempo médio de conclusão</Text>
            <Text style={{ fontSize: 28, fontWeight: '700', color: COR.tinta }}>
              {tempoMedio !== null ? formatarDuracao(tempoMedio) : '—'}
            </Text>
          </View>
        </View>
      )}

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
