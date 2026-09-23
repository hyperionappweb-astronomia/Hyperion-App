import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../../services/supabase'

const COR = {
  fundo: '#f4f5f9',
  tinta: '#1c2050',
  borda: '#d3d7e6',
  suave: '#5b6080',
  erro: '#b3261e',
  cartao: '#fff',
}

// "01:23:45" -> "1h 23min"
function formatarTempo(hms: string | null) {
  if (!hms) return '—'
  const [h, m] = hms.split(':').map(Number)
  if (h > 0) return `${h}h ${m}min`
  return `${m} min`
}

export default function ResultadoSimulado() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const idResultado = Number(id)
  const router = useRouter()

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [pontuacao, setPontuacao] = useState(0)
  const [acertos, setAcertos] = useState(0)
  const [total, setTotal] = useState(0)
  const [tempoGasto, setTempoGasto] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isFinite(idResultado)) {
      setErro('Resultado inválido.')
      return setCarregando(false)
    }

    async function carregar() {
      const { data: resultado, error: erroResultado } = await supabase
        .from('resultado_simulado')
        .select('status, pontuacao_obtida, tempo_gasto, id_simulado')
        .eq('id_resultado', idResultado)
        .single()

      if (erroResultado || !resultado) {
        setErro('Não foi possível encontrar este resultado.')
        return setCarregando(false)
      }

      if (resultado.status !== 'CONCLUIDO') {
        // Simulado ainda em andamento: volta para a tela de responder
        return router.replace({
          pathname: '/simulado/[id]',
          params: { id: String(idResultado) },
        })
      }

      const [{ data: simulado }, { count: totalCorretas }] = await Promise.all([
        supabase
          .from('simulado')
          .select('quantidade_questoes')
          .eq('id_simulado', resultado.id_simulado)
          .single(),
        supabase
          .from('historico_resposta')
          .select('id_resposta', { count: 'exact', head: true })
          .eq('id_resultado', idResultado)
          .eq('correta', true),
      ])

      setPontuacao(Number(resultado.pontuacao_obtida ?? 0))
      setTempoGasto(resultado.tempo_gasto)
      setTotal(simulado?.quantidade_questoes ?? 0)
      setAcertos(totalCorretas ?? 0)
      setCarregando(false)
    }

    carregar()
  }, [idResultado])

  if (carregando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: COR.fundo }}>
        <ActivityIndicator />
      </View>
    )
  }

  if (erro) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 12, backgroundColor: COR.fundo }}>
        <Text style={{ color: COR.erro }}>{erro}</Text>
        <Pressable onPress={() => router.replace('/')}>
          <Text style={{ color: COR.tinta, fontWeight: '600' }}>Voltar para o início</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 20, backgroundColor: COR.fundo }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: COR.tinta, textAlign: 'center' }}>
        Simulado concluído!
      </Text>

      <View
        style={{
          padding: 24,
          borderRadius: 16,
          backgroundColor: COR.cartao,
          borderWidth: 1,
          borderColor: COR.borda,
          gap: 16,
        }}
      >
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 40, fontWeight: '700', color: COR.tinta }}>
            {pontuacao.toFixed(0)}%
          </Text>
          <Text style={{ color: COR.suave }}>Pontuação</Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: COR.tinta }}>
              {acertos}/{total}
            </Text>
            <Text style={{ color: COR.suave, fontSize: 13 }}>Acertos</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: COR.tinta }}>
              {formatarTempo(tempoGasto)}
            </Text>
            <Text style={{ color: COR.suave, fontSize: 13 }}>Tempo levado</Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => router.replace('/')}
        style={{
          marginTop: 'auto',
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: 'center',
          backgroundColor: COR.tinta,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
          Voltar para o início
        </Text>
      </Pressable>
    </View>
  )
}
