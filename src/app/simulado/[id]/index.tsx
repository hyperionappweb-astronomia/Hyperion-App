import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../../services/supabase'
import { finalizarSimulado, type RespostaSimulado } from '../../../services/simulados'

type Questao = {
  id_questao: number
  enunciado: string
  imagem: string | null
  alternativa_a: string | null
  alternativa_b: string | null
  alternativa_c: string | null
  alternativa_d: string | null
  alternativa_e: string | null
}

const COR = {
  fundo: '#f4f5f9',
  tinta: '#1c2050',
  borda: '#d3d7e6',
  suave: '#5b6080',
  erro: '#b3261e',
  cartao: '#fff',
  respondida: '#c9cff2',
}

function alternativas(q: Questao) {
  return [
    { letra: 'A', texto: q.alternativa_a },
    { letra: 'B', texto: q.alternativa_b },
    { letra: 'C', texto: q.alternativa_c },
    { letra: 'D', texto: q.alternativa_d },
    { letra: 'E', texto: q.alternativa_e },
  ].filter((a) => a.texto)
}

// Corta o enunciado no marcador "[IMAGEM]" (se ele existir), para desenhar
// texto -> imagem -> texto. Sem o marcador, tudo cai em "antes" (comportamento
// antigo: imagem em cima, texto inteiro embaixo).
const MARCADOR_IMAGEM = /\[imagem\]/i
function partesDoEnunciado(enunciado: string) {
  const partes = enunciado.split(MARCADOR_IMAGEM)
  return { antes: partes[0].trim(), depois: (partes[1] ?? '').trim() }
}

// "02:00:00" -> segundos
function paraSegundos(hms: string) {
  const [h, m, s] = hms.split(':').map(Number)
  return h * 3600 + m * 60 + (s || 0)
}

function formatarRestante(segundos: number) {
  const s = Math.max(0, Math.floor(segundos))
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const seg = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${seg}`
}

export default function ResponderSimulado() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const idResultado = Number(id)
  const router = useRouter()

  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [questoes, setQuestoes] = useState<Questao[]>([])
  const [respostas, setRespostas] = useState<Record<number, string>>({}) // id_questao -> letra
  const [indice, setIndice] = useState(0)
  const [selecao, setSelecao] = useState<string | null>(null)
  const [prazo, setPrazo] = useState<number | null>(null) // timestamp (ms) do fim
  const [restante, setRestante] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [imagemUrl, setImagemUrl] = useState<string | null>(null)

  const finalizando = useRef(false) // trava contra envio duplicado

  // ---------- Carrega a tentativa, o simulado e as questões ----------
  useEffect(() => {
    if (!Number.isFinite(idResultado)) {
      setErroCarga('Simulado inválido.')
      setCarregando(false)
      return
    }

    async function carregar() {
      const { data: resultado, error: erroResultado } = await supabase
        .from('resultado_simulado')
        .select('id_simulado, status, data_inicio')
        .eq('id_resultado', idResultado)
        .single()

      if (erroResultado || !resultado) {
        setErroCarga('Não foi possível encontrar este simulado.')
        return setCarregando(false)
      }
      if (resultado.status === 'CONCLUIDO') {
        return router.replace({
          pathname: '/simulado/[id]/resultado',
          params: { id: String(idResultado) },
        })
      }

      const { data: simulado, error: erroSimulado } = await supabase
        .from('simulado')
        .select('tempo_limite')
        .eq('id_simulado', resultado.id_simulado)
        .single()
      if (erroSimulado || !simulado?.tempo_limite) {
        setErroCarga('Não foi possível carregar o tempo do simulado.')
        return setCarregando(false)
      }

      const { data: itens, error: erroItens } = await supabase
        .from('simulado_compostopor_questao')
        .select(
          'questao(id_questao, enunciado, imagem, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e)'
        )
        .eq('id_simulado', resultado.id_simulado)
        // id_questao é coluna da própria simulado_compostopor_questao,
        // não precisa (e não pode) ordenar dentro da tabela aninhada "questao"
        .order('id_questao')

      if (erroItens || !itens) {
        setErroCarga('Não foi possível carregar as questões.')
        return setCarregando(false)
      }
      const lista = itens
        .map((i: any) => i.questao)
        .filter(Boolean) as unknown as Questao[]

      // Recupera respostas já confirmadas (ex.: o app fechou e foi reaberto)
      const { data: historico } = await supabase
        .from('historico_resposta')
        .select('id_questao, alternativa_marcada')
        .eq('id_resultado', idResultado)

      const jaRespondidas: Record<number, string> = {}
      for (const h of historico ?? []) jaRespondidas[h.id_questao] = h.alternativa_marcada

      const inicioMs = new Date(resultado.data_inicio).getTime()
      const fimMs = inicioMs + paraSegundos(simulado.tempo_limite) * 1000

      setQuestoes(lista)
      setRespostas(jaRespondidas)
      // Começa na primeira questão ainda sem resposta, se houver
      const primeiraPendente = lista.findIndex((q) => !jaRespondidas[q.id_questao])
      setIndice(primeiraPendente === -1 ? 0 : primeiraPendente)
      setPrazo(fimMs)
      setRestante(Math.max(0, (fimMs - Date.now()) / 1000))
      setCarregando(false)
    }

    carregar()
  }, [idResultado])

  // ---------- Cronômetro ----------
  useEffect(() => {
    if (prazo === null) return
    const t = setInterval(() => {
      const r = (prazo - Date.now()) / 1000
      setRestante(Math.max(0, r))
      if (r <= 0) {
        clearInterval(t)
        finalizar(true)
      }
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prazo])

  const questaoAtual = questoes[indice]

  // Ao trocar de questão, mostra a resposta já confirmada (se houver)
  useEffect(() => {
    setSelecao(questaoAtual ? respostas[questaoAtual.id_questao] ?? null : null)
    setErroEnvio(null)
  }, [indice, questoes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Link temporário para a imagem da questão atual
  useEffect(() => {
    setImagemUrl(null)
    const caminho = questaoAtual?.imagem
    if (!caminho) return
    let cancelado = false
    supabase.storage
      .from('questoes')
      .createSignedUrl(caminho, 3600)
      .then(({ data }) => {
        if (!cancelado && data) setImagemUrl(data.signedUrl)
      })
    return () => {
      cancelado = true
    }
  }, [questaoAtual?.imagem])

  const ultima = indice === questoes.length - 1

  const finalizar = useCallback(
    async (porTempo: boolean) => {
      if (finalizando.current) return
      finalizando.current = true
      setEnviando(true)
      try {
        const todas: RespostaSimulado[] = Object.entries(respostas).map(
          ([idQuestao, alternativa]) => ({
            id_questao: Number(idQuestao),
            alternativa: alternativa as RespostaSimulado['alternativa'],
          })
        )
        await finalizarSimulado(idResultado, todas)
        router.replace({
          pathname: '/simulado/[id]/resultado',
          params: { id: String(idResultado) },
        })
      } catch {
        finalizando.current = false
        setEnviando(false)
        setErroEnvio(
          porTempo
            ? 'O tempo acabou, mas não conseguimos enviar o simulado. Tente novamente.'
            : 'Não foi possível finalizar. Tente novamente.'
        )
      }
    },
    [idResultado, respostas, router]
  )

  async function confirmar() {
    if (!questaoAtual || !selecao) return
    setEnviando(true)
    setErroEnvio(null)
    const { error } = await supabase.rpc('salvar_resposta_simulado', {
      p_id_resultado: idResultado,
      p_id_questao: questaoAtual.id_questao,
      p_alternativa: selecao,
    })
    setEnviando(false)
    if (error) return setErroEnvio('Não foi possível salvar. Tente novamente.')

    const novas = { ...respostas, [questaoAtual.id_questao]: selecao }
    setRespostas(novas)

    if (ultima) {
      await finalizar(false)
    } else {
      setIndice(indice + 1)
    }
  }

  if (carregando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: COR.fundo }}>
        <ActivityIndicator />
      </View>
    )
  }

  if (erroCarga || questoes.length === 0) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 12, backgroundColor: COR.fundo }}>
        <Text style={{ color: COR.erro }}>{erroCarga ?? 'Simulado sem questões.'}</Text>
        <Pressable onPress={() => router.replace('/')}>
          <Text style={{ color: COR.tinta, fontWeight: '600' }}>Voltar para o início</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: COR.fundo }}>
      {/* Cronômetro */}
      <View
        style={{
          alignItems: 'center',
          paddingVertical: 8,
          backgroundColor: restante < 300 ? '#fde3e1' : '#eef0fb',
        }}
      >
        <Text
          style={{
            fontWeight: '700',
            color: restante < 300 ? COR.erro : COR.tinta,
          }}
        >
          Tempo restante: {formatarRestante(restante)}
        </Text>
      </View>

      {/* Quadradinhos de navegação entre questões */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, padding: 12 }}
        style={{ flexGrow: 0, borderBottomWidth: 1, borderColor: COR.borda }}
      >
        {questoes.map((q, i) => {
          const respondida = respostas[q.id_questao] !== undefined
          const atual = i === indice
          return (
            <Pressable
              key={q.id_questao}
              accessibilityRole="button"
              accessibilityState={{ selected: atual }}
              onPress={() => setIndice(i)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: atual ? 2 : 1,
                borderColor: atual ? COR.tinta : COR.borda,
                backgroundColor: respondida ? COR.respondida : '#fff',
              }}
            >
              <Text style={{ color: COR.tinta, fontWeight: atual ? '700' : '400' }}>
                {i + 1}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Questão */}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ color: COR.suave, fontSize: 13 }}>
          Questão {indice + 1} de {questoes.length}
        </Text>

        {(() => {
          const { antes, depois } = partesDoEnunciado(questaoAtual.enunciado)
          return (
            <>
              {antes ? (
                <Text style={{ fontSize: 16, color: COR.tinta, lineHeight: 22 }}>
                  {antes}
                </Text>
              ) : null}

              {imagemUrl && (
                <Image
                  source={{ uri: imagemUrl }}
                  style={{ width: '100%', height: 200, borderRadius: 10, backgroundColor: '#e6e8f5' }}
                  resizeMode="contain"
                />
              )}

              {depois ? (
                <Text style={{ fontSize: 16, color: COR.tinta, lineHeight: 22 }}>
                  {depois}
                </Text>
              ) : null}
            </>
          )
        })()}

        <View style={{ gap: 8 }}>
          {alternativas(questaoAtual).map((a) => {
            const marcada = selecao === a.letra
            return (
              <Pressable
                key={a.letra}
                accessibilityRole="radio"
                accessibilityState={{ checked: marcada }}
                disabled={enviando}
                onPress={() => setSelecao(a.letra)}
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: marcada ? COR.tinta : COR.borda,
                  backgroundColor: marcada ? '#eef0fb' : '#fff',
                  opacity: enviando ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: '700', color: COR.tinta }}>{a.letra}</Text>
                <Text style={{ color: COR.tinta, flex: 1, lineHeight: 20 }}>{a.texto}</Text>
              </Pressable>
            )
          })}
        </View>

        {erroEnvio && <Text style={{ color: COR.erro }}>{erroEnvio}</Text>}

        <Pressable
          disabled={!selecao || enviando}
          onPress={confirmar}
          style={{
            marginTop: 8,
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: !selecao || enviando ? COR.borda : COR.tinta,
          }}
        >
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {ultima ? 'Finalizar simulado' : 'Confirmar'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  )
}
