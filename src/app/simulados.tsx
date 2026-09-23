import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { iniciarSimulado } from '../services/simulados'
import { supabase } from '../services/supabase'

type Nivel = { id_nivel: number; descricao: string; codigo_nivel: string }

const QUANTIDADES = [10, 15, 20] as const

const COR = {
  fundo: '#f4f5f9',
  tinta: '#1c2050',
  borda: '#d3d7e6',
  suave: '#5b6080',
  erro: '#b3261e',
  cartao: '#fff',
}

// Mesma regra da função criar_simulado_aleatorio no banco: só o nível "4" tem 3h
function tempoLimite(nivel: Nivel | null) {
  if (!nivel) return null
  return nivel.codigo_nivel === '4' ? '3 horas' : '2 horas'
}

export default function Simulados() {
  const router = useRouter()
  const [niveis, setNiveis] = useState<Nivel[]>([])
  const [carregandoNiveis, setCarregandoNiveis] = useState(true)
  const [nivel, setNivel] = useState<Nivel | null>(null)
  const [quantidade, setQuantidade] = useState<(typeof QUANTIDADES)[number] | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

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

  async function comecar() {
    if (!nivel || !quantidade) return
    setErro(null)
    setIniciando(true)
    try {
      // 1) O servidor sorteia as questões (mínimo 3 de Astronáutica e 7 de
      // Astronomia) e cria o simulado. Nunca é feito no app, para não dar
      // para "escolher" as questões nem ver o gabarito.
      const { data: idSimulado, error: erroRpc } = await supabase.rpc(
        'criar_simulado_aleatorio',
        { p_id_nivel: nivel.id_nivel, p_quantidade: quantidade }
      )
      if (erroRpc || !idSimulado) {
        throw new Error(
          erroRpc?.message?.includes('suficientes')
            ? 'Não há questões suficientes cadastradas nesse nível ainda.'
            : 'Não foi possível montar o simulado. Tente novamente.'
        )
      }

      // 2) Abre a tentativa (cria a linha em resultado_simulado)
      const idResultado = await iniciarSimulado(idSimulado)

      // A tela de responder o simulado (com cronômetro e navegação entre
      // questões) ainda não existe; troque a rota abaixo quando ela existir.
      router.push({pathname: '/simulado/[id]', params: { id: String(idResultado) },
})
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível iniciar o simulado.')
    } finally {
      setIniciando(false)
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 20, backgroundColor: COR.fundo }}>
      {/* 1) Nível */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: COR.tinta }}>Nível</Text>
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
                  onPress={() => setNivel(n)}
                  style={{
                    flexGrow: 1,
                    flexBasis: '45%',
                    minHeight: 96,
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
                      fontSize: 18,
                      fontWeight: '700',
                      color: ativo ? '#fff' : COR.tinta,
                    }}
                  >
                    Nível {n.codigo_nivel}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: ativo ? '#dfe1f7' : COR.suave,
                    }}
                  >
                    {n.descricao}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}
      </View>

      {/* 2) Quantidade de questões */}
      {nivel && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: COR.tinta }}>
            Quantidade de questões
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {QUANTIDADES.map((q) => {
              const ativo = q === quantidade
              return (
                <Pressable
                  key={q}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  onPress={() => setQuantidade(q)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: ativo ? COR.tinta : COR.borda,
                    backgroundColor: ativo ? COR.tinta : COR.cartao,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: ativo ? '#fff' : COR.tinta,
                    }}
                  >
                    {q}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      )}

      {/* 3) Resumo + tempo limite (fixo, não é escolhido) */}
      {nivel && quantidade && (
        <View
          style={{
            padding: 14,
            borderRadius: 12,
            backgroundColor: '#eef0fb',
            gap: 4,
          }}
        >
          <Text style={{ color: COR.tinta }}>
            Nível {nivel.codigo_nivel} · {quantidade} questões
          </Text>
          <Text style={{ color: COR.suave, fontSize: 13 }}>
            Tempo limite: {tempoLimite(nivel)} · no mínimo 3 questões de
            Astronáutica e 7 de Astronomia
          </Text>
        </View>
      )}

      {erro && <Text style={{ color: COR.erro }}>{erro}</Text>}

      <Pressable
        disabled={!nivel || !quantidade || iniciando}
        onPress={comecar}
        style={{
          marginTop: 'auto',
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: 'center',
          backgroundColor: !nivel || !quantidade ? COR.borda : COR.tinta,
        }}
      >
        {iniciando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            Iniciar simulado
          </Text>
        )}
      </Pressable>
    </View>
  )
}
