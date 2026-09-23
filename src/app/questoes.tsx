import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { supabase } from '../services/supabase'

type Nivel = { id_nivel: number; descricao: string; codigo_nivel: string }
type Questao = {
  id_questao: number
  enunciado: string
  assunto: string | null
  imagem: string | null
  alternativa_a: string | null
  alternativa_b: string | null
  alternativa_c: string | null
  alternativa_d: string | null
  alternativa_e: string | null
}

// Estado de resposta de UMA questão, guardado por id_questao
type EstadoResposta = {
  escolhida: string
  status: 'verificando' | 'correta' | 'incorreta' | 'erro'
}

const COR = {
  fundo: '#f4f5f9',
  tinta: '#1c2050',
  borda: '#d3d7e6',
  suave: '#5b6080',
  erro: '#b3261e',
  acerto: '#1e7d32',
  cartao: '#fff',
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

export default function Questoes() {
  const [niveis, setNiveis] = useState<Nivel[]>([])
  const [carregandoNiveis, setCarregandoNiveis] = useState(true)
  const [nivel, setNivel] = useState<Nivel | null>(null)

  const [questoesDoNivel, setQuestoesDoNivel] = useState<Questao[]>([])
  const [carregandoQuestoes, setCarregandoQuestoes] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [assunto, setAssunto] = useState<string | null>(null) // null = "Todos"
  const [modalAberto, setModalAberto] = useState(false)

  const [respostas, setRespostas] = useState<Record<number, EstadoResposta>>({})
  const [imagens, setImagens] = useState<Record<string, string>>({}) // caminho -> link temporário

  const reqNivel = useRef(0)

  useEffect(() => {
    supabase
      .from('nivel')
      .select('id_nivel, descricao, codigo_nivel')
      .order('codigo_nivel')
      .then(({ data, error }) => {
        if (error) setErro('Não foi possível carregar os níveis. Tente novamente.')
        else setNiveis(data ?? [])
        setCarregandoNiveis(false)
      })
  }, [])

  async function escolherNivel(n: Nivel) {
    if (n.id_nivel === nivel?.id_nivel) return
    const req = ++reqNivel.current
    setNivel(n)
    setAssunto(null)
    setRespostas({})
    setQuestoesDoNivel([])
    setErro(null)
    setCarregandoQuestoes(true)

    // Nota: o gabarito nunca vem aqui (a permissão da tabela não libera essa coluna).
    const { data, error } = await supabase
      .from('questao')
      .select(
        'id_questao, enunciado, assunto, imagem, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e'
      )
      .eq('id_nivel', n.id_nivel)
      .order('id_questao')

    if (req !== reqNivel.current) return
    if (error) setErro('Não foi possível carregar as questões. Tente novamente.')
    else setQuestoesDoNivel(data ?? [])
    setCarregandoQuestoes(false)
  }

  const assuntos = useMemo(() => {
    const vistos = new Set<string>()
    for (const q of questoesDoNivel) if (q.assunto) vistos.add(q.assunto)
    return [...vistos].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [questoesDoNivel])

  const questoesFiltradas = useMemo(
    () =>
      assunto
        ? questoesDoNivel.filter((q) => q.assunto === assunto)
        : questoesDoNivel,
    [questoesDoNivel, assunto]
  )

  function escolherAssunto(a: string | null) {
    setAssunto(a)
    setModalAberto(false)
  }

  // Gera (uma vez) o link temporário de cada imagem das questões do nível
  useEffect(() => {
    const caminhos = [...new Set(questoesDoNivel.map((q) => q.imagem).filter(Boolean))] as string[]
    const faltando = caminhos.filter((c) => !(c in imagens))
    if (faltando.length === 0) return

    Promise.all(
      faltando.map((c) => supabase.storage.from('questoes').createSignedUrl(c, 3600))
    ).then((resultados) => {
      setImagens((atual) => {
        const novo = { ...atual }
        resultados.forEach((r, i) => {
          if (r.data) novo[faltando[i]] = r.data.signedUrl
        })
        return novo
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questoesDoNivel])

  async function responder(q: Questao, letra: string) {
    const atual = respostas[q.id_questao]
    if (atual && atual.status !== 'erro') return // já respondida: trava a escolha

    setRespostas((r) => ({ ...r, [q.id_questao]: { escolhida: letra, status: 'verificando' } }))

    const { data, error } = await supabase.rpc('verificar_resposta_questao', {
      p_id_questao: q.id_questao,
      p_alternativa: letra,
    })

    setRespostas((r) => ({
      ...r,
      [q.id_questao]: {
        escolhida: letra,
        status: error ? 'erro' : data ? 'correta' : 'incorreta',
      },
    }))
  }

  const compacto = !!nivel

  return (
    <View style={{ flex: 1, backgroundColor: COR.fundo }}>
      <View style={{ padding: 16, gap: 14 }}>
        {/* 1) Seletor de nível */}
        {carregandoNiveis ? (
          <ActivityIndicator />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {niveis.map((n) => {
              const ativo = n.id_nivel === nivel?.id_nivel
              return (
                <Pressable
                  key={n.id_nivel}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  onPress={() => escolherNivel(n)}
                  style={{
                    flexGrow: 1,
                    flexBasis: compacto ? '22%' : '45%',
                    minHeight: compacto ? 52 : 112,
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: ativo ? COR.tinta : COR.borda,
                    backgroundColor: ativo ? COR.tinta : COR.cartao,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: compacto ? 15 : 20,
                      fontWeight: '700',
                      color: ativo ? '#fff' : COR.tinta,
                    }}
                  >
                    Nível {n.codigo_nivel}
                  </Text>
                  {!compacto && (
                    <Text
                      numberOfLines={2}
                      style={{ marginTop: 6, fontSize: 13, color: COR.suave }}
                    >
                      {n.descricao}
                    </Text>
                  )}
                </Pressable>
              )
            })}
          </View>
        )}

        {!nivel && !carregandoNiveis && !erro && (
          <Text style={{ color: COR.suave }}>
            Escolha um nível para ver as questões disponíveis.
          </Text>
        )}

        {/* 2) Filtro de assunto: abre um seletor (modal) */}
        {nivel && !carregandoQuestoes && questoesDoNivel.length > 0 && (
          <Pressable
            onPress={() => setModalAberto(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COR.borda,
              backgroundColor: COR.cartao,
            }}
          >
            <Text style={{ color: COR.tinta, fontWeight: '600' }}>
              Assunto: {assunto ?? 'Todos'}
            </Text>
            <Text style={{ color: COR.suave, fontSize: 18 }}>⌄</Text>
          </Pressable>
        )}

        {carregandoQuestoes && <ActivityIndicator />}
        {erro && <Text style={{ color: COR.erro }}>{erro}</Text>}

        {nivel && !carregandoQuestoes && !erro && questoesDoNivel.length === 0 && (
          <Text style={{ color: COR.suave }}>
            Ainda não há questões no nível {nivel.codigo_nivel}.
          </Text>
        )}
      </View>

      {/* 3) Questões, uma embaixo da outra */}
      {nivel && !carregandoQuestoes && questoesDoNivel.length > 0 && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 16 }}>
          {questoesFiltradas.length === 0 ? (
            <Text style={{ color: COR.suave }}>
              Nenhuma questão de "{assunto}" neste nível.
            </Text>
          ) : (
            questoesFiltradas.map((questao) => {
              const { antes, depois } = partesDoEnunciado(questao.enunciado)
              const estado = respostas[questao.id_questao]
              const imagemUrl = questao.imagem ? imagens[questao.imagem] : undefined

              return (
                <View
                  key={questao.id_questao}
                  style={{
                    gap: 14,
                    padding: 16,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: COR.borda,
                    backgroundColor: COR.cartao,
                  }}
                >
                  {questao.assunto && (
                    <Text style={{ color: COR.suave, fontSize: 13 }}>{questao.assunto}</Text>
                  )}

                  {antes ? (
                    <Text style={{ fontSize: 16, color: COR.tinta, lineHeight: 22 }}>
                      {antes}
                    </Text>
                  ) : null}

                  {imagemUrl && (
                    <Image
                      source={{ uri: imagemUrl }}
                      style={{
                        width: '100%',
                        height: 180,
                        borderRadius: 10,
                        backgroundColor: '#eef0fb',
                      }}
                      resizeMode="contain"
                    />
                  )}

                  {depois ? (
                    <Text style={{ fontSize: 16, color: COR.tinta, lineHeight: 22 }}>
                      {depois}
                    </Text>
                  ) : null}

                  <View style={{ gap: 8 }}>
                    {alternativas(questao).map((a) => {
                      const selecionada = estado?.escolhida === a.letra
                      let corBorda = COR.borda
                      let corFundo = '#fff'
                      if (selecionada && estado?.status === 'verificando') {
                        corBorda = COR.tinta
                        corFundo = '#eef0fb'
                      } else if (selecionada && estado?.status === 'correta') {
                        corBorda = COR.acerto
                        corFundo = '#e6f4ea'
                      } else if (selecionada && estado?.status === 'incorreta') {
                        corBorda = COR.erro
                        corFundo = '#fde3e1'
                      }
                      return (
                        <Pressable
                          key={a.letra}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selecionada }}
                          onPress={() => responder(questao, a.letra)}
                          style={{
                            flexDirection: 'row',
                            gap: 10,
                            padding: 12,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: corBorda,
                            backgroundColor: corFundo,
                          }}
                        >
                          <Text style={{ fontWeight: '700', color: COR.tinta }}>{a.letra}</Text>
                          <Text style={{ color: COR.tinta, flex: 1, lineHeight: 20 }}>
                            {a.texto}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>

                  {estado?.status === 'correta' && (
                    <Text style={{ color: COR.acerto, fontWeight: '700' }}>Você acertou!</Text>
                  )}
                  {estado?.status === 'incorreta' && (
                    <Text style={{ color: COR.erro, fontWeight: '700' }}>Você errou.</Text>
                  )}
                  {estado?.status === 'erro' && (
                    <Text style={{ color: COR.erro }}>
                      Não foi possível verificar. Toque na alternativa de novo.
                    </Text>
                  )}
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      {/* Seletor de assunto */}
      <Modal
        visible={modalAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalAberto(false)}
      >
        <Pressable
          onPress={() => setModalAberto(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(20,22,40,0.45)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Pressable
            onPress={() => {}} // evita fechar ao tocar dentro do cartão
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 8,
              maxHeight: '70%',
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: COR.tinta,
                padding: 12,
              }}
            >
              Escolha o assunto
            </Text>
            <ScrollView>
              <Pressable
                onPress={() => escolherAssunto(null)}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  backgroundColor: assunto === null ? '#eef0fb' : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: COR.tinta,
                    fontWeight: assunto === null ? '700' : '400',
                  }}
                >
                  Todos
                </Text>
              </Pressable>
              {assuntos.map((a) => (
                <Pressable
                  key={a}
                  onPress={() => escolherAssunto(a)}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    backgroundColor: assunto === a ? '#eef0fb' : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: COR.tinta,
                      fontWeight: assunto === a ? '700' : '400',
                    }}
                  >
                    {a}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}
