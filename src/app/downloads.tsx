import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useEffect } from 'react'
import { supabase } from '../services/supabase'

type Nivel = { id_nivel: number; descricao: string; codigo_nivel: string }
type Conteudo = {
  id_conteudo: number
  nome_conteudo: string
  materia: string | null
  pdf_path: string | null
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

const ORDEM_MATERIAS = ['Astronomia', 'Astronáutica']

function agruparPorMateria(lista: Conteudo[]) {
  const mapa = new Map<string, Conteudo[]>()
  for (const c of lista) {
    const chave = c.materia?.trim() || 'Outros'
    mapa.set(chave, [...(mapa.get(chave) ?? []), c])
  }
  const pos = (m: string) => {
    const i = ORDEM_MATERIAS.indexOf(m)
    return i === -1 ? ORDEM_MATERIAS.length : i
  }
  return [...mapa.entries()]
    .sort((a, b) => pos(a[0]) - pos(b[0]) || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([titulo, itens]) => ({ titulo, itens }))
}

type StatusDownload = { progresso: number; ok?: boolean; erro?: string }

// Uma seção: título da matéria + fileira de cards que rola para o lado
function Faixa({
  titulo,
  itens,
  status,
  onBaixar,
}: {
  titulo: string
  itens: Conteudo[]
  status: Record<number, StatusDownload>
  onBaixar: (c: Conteudo) => void
}) {
  const ref = useRef<ScrollView>(null)
  const [scrollX, setScrollX] = useState(0)
  const [visivel, setVisivel] = useState(0)
  const [total, setTotal] = useState(0)
  const podeRolar = total > visivel + 1
  const noInicio = scrollX <= 1
  const noFim = scrollX + visivel >= total - 1

  function rolar(sentido: 1 | -1) {
    const passo = Math.max(visivel * 0.7, 160)
    ref.current?.scrollTo({ x: Math.max(0, scrollX + sentido * passo), animated: true })
  }

  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: COR.tinta }}>{titulo}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {podeRolar && (
          <Pressable
            disabled={noInicio}
            onPress={() => rolar(-1)}
            style={{
              width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: COR.borda,
              backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
              opacity: noInicio ? 0.35 : 1,
            }}
          >
            <Text style={{ fontSize: 22, lineHeight: 24, color: COR.tinta }}>‹</Text>
          </Pressable>
        )}
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator
          scrollEventThrottle={16}
          onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
          onLayout={(e) => setVisivel(e.nativeEvent.layout.width)}
          onContentSizeChange={(w) => setTotal(w)}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
        >
          {itens.map((c) => {
            const s = status[c.id_conteudo]
            const baixando = s && s.progresso < 1 && !s.ok && !s.erro
            return (
              <Pressable
                key={c.id_conteudo}
                accessibilityRole="button"
                onPress={() => onBaixar(c)}
                disabled={!!baixando}
                style={{
                  flexShrink: 0,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: s?.ok ? COR.acerto : s?.erro ? COR.erro : COR.borda,
                  backgroundColor: '#fff',
                }}
              >
                {baixando && <ActivityIndicator size="small" color={COR.tinta} />}
                <Text style={{ color: COR.tinta, fontWeight: '600' }}>{c.nome_conteudo}</Text>
                {s?.ok && <Text style={{ color: COR.acerto }}>✓</Text>}
                {baixando && (
                  <Text style={{ color: COR.suave, fontSize: 12 }}>
                    {Math.round(s.progresso * 100)}%
                  </Text>
                )}
              </Pressable>
            )
          })}
        </ScrollView>
        {podeRolar && (
          <Pressable
            disabled={noFim}
            onPress={() => rolar(1)}
            style={{
              width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: COR.borda,
              backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
              opacity: noFim ? 0.35 : 1,
            }}
          >
            <Text style={{ fontSize: 22, lineHeight: 24, color: COR.tinta }}>›</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

export default function Downloads() {
  const [niveis, setNiveis] = useState<Nivel[]>([])
  const [carregandoNiveis, setCarregandoNiveis] = useState(true)
  const [nivel, setNivel] = useState<Nivel | null>(null)
  const [conteudos, setConteudos] = useState<Conteudo[]>([])
  const [carregandoConteudos, setCarregandoConteudos] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [status, setStatus] = useState<Record<number, StatusDownload>>({})

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
    setConteudos([])
    setStatus({})
    setErro(null)
    setCarregandoConteudos(true)

    const { data, error } = await supabase
      .from('conteudo')
      .select('id_conteudo, nome_conteudo, materia, pdf_path')
      .eq('id_nivel', n.id_nivel)
      .order('nome_conteudo')

    if (req !== reqNivel.current) return
    if (error) setErro('Não foi possível carregar os conteúdos. Tente novamente.')
    else setConteudos(data ?? [])
    setCarregandoConteudos(false)
  }

  async function baixar(c: Conteudo) {
    if (!c.pdf_path) {
      setStatus((s) => ({ ...s, [c.id_conteudo]: { progresso: 0, erro: 'sem pdf' } }))
      return
    }
    setStatus((s) => ({ ...s, [c.id_conteudo]: { progresso: 0 } }))

    const { data, error: erroLink } = await supabase.storage
      .from('conteudos')
      .createSignedUrl(c.pdf_path, 300)

    if (erroLink || !data) {
      setStatus((s) => ({ ...s, [c.id_conteudo]: { progresso: 0, erro: 'link' } }))
      return
    }

    const nomeArquivo = c.pdf_path.split('/').pop() || `${c.nome_conteudo}.pdf`

    // Na web, deixa o navegador cuidar do download (abre/baixa numa aba nova)
    if (Platform.OS === 'web') {
      // @ts-ignore -- window só existe na web
      window.open(data.signedUrl, '_blank')
      setStatus((s) => ({ ...s, [c.id_conteudo]: { progresso: 1, ok: true } }))
      return
    }

    try {
      const destino = FileSystem.cacheDirectory + nomeArquivo
      const download = FileSystem.createDownloadResumable(
        data.signedUrl,
        destino,
        {},
        (p) => {
          const progresso =
            p.totalBytesExpectedToWrite > 0
              ? p.totalBytesWritten / p.totalBytesExpectedToWrite
              : 0
          setStatus((s) => ({ ...s, [c.id_conteudo]: { progresso } }))
        }
      )
      const resultado = await download.downloadAsync()
      if (!resultado) throw new Error('download falhou')

      // Abre o menu de compartilhar/salvar do Android (Arquivos, Drive, etc.)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(resultado.uri, {
          mimeType: 'application/pdf',
          dialogTitle: c.nome_conteudo,
        })
      }
      setStatus((s) => ({ ...s, [c.id_conteudo]: { progresso: 1, ok: true } }))
    } catch {
      setStatus((s) => ({ ...s, [c.id_conteudo]: { progresso: 0, erro: 'download' } }))
    }
  }

  const compacto = !!nivel
  const grupos = agruparPorMateria(conteudos)
  const algumErro = Object.values(status).some((s) => s.erro)

  return (
    <View style={{ flex: 1, backgroundColor: COR.fundo }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
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
                    <Text numberOfLines={2} style={{ marginTop: 6, fontSize: 13, color: COR.suave }}>
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
            Escolha um nível para ver os PDFs disponíveis para download.
          </Text>
        )}

        {carregandoConteudos && <ActivityIndicator />}
        {erro && <Text style={{ color: COR.erro }}>{erro}</Text>}

        {nivel && !carregandoConteudos && !erro && conteudos.length === 0 && (
          <Text style={{ color: COR.suave }}>
            Ainda não há conteúdos no nível {nivel.codigo_nivel}.
          </Text>
        )}

        {/* 2) Seções de conteúdo, uma por matéria */}
        {nivel && !carregandoConteudos && conteudos.length > 0 && (
          <View style={{ gap: 10 }}>
            {grupos.map((g) => (
              <Faixa key={g.titulo} titulo={g.titulo} itens={g.itens} status={status} onBaixar={baixar} />
            ))}
          </View>
        )}

        {algumErro && (
          <Text style={{ color: COR.erro }}>
            Não foi possível baixar um dos PDFs. Toque nele de novo para tentar outra vez.
          </Text>
        )}
      </ScrollView>
    </View>
  )
}
