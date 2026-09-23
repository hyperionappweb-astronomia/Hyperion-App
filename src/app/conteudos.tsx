import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { supabase } from '../services/supabase'
import PdfViewer from '../components/PdfViewer'

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
  leitor: '#2a2d45',
}

// Ordem das seções; matérias novas aparecem depois, em ordem alfabética
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

// Botão redondo de rolagem lateral (útil no navegador, onde não dá para "arrastar")
function Seta({
  direcao,
  desabilitada,
  onPress,
}: {
  direcao: 'esquerda' | 'direita'
  desabilitada: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        direcao === 'esquerda' ? 'Ver conteúdos anteriores' : 'Ver próximos conteúdos'
      }
      disabled={desabilitada}
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COR.borda,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: desabilitada ? 0.35 : 1,
      }}
    >
      <Text style={{ fontSize: 22, lineHeight: 24, color: COR.tinta }}>
        {direcao === 'esquerda' ? '‹' : '›'}
      </Text>
    </Pressable>
  )
}

// Uma seção: título da matéria + fileira de cards que rola para o lado.
// Cada seção tem a própria rolagem.
function Faixa({
  titulo,
  itens,
  ativoId,
  onAbrir,
}: {
  titulo: string
  itens: Conteudo[]
  ativoId?: number
  onAbrir: (c: Conteudo) => void
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
          <Seta direcao="esquerda" desabilitada={noInicio} onPress={() => rolar(-1)} />
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
            const ativo = c.id_conteudo === ativoId
            return (
              <Pressable
                key={c.id_conteudo}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                onPress={() => onAbrir(c)}
                style={{
                  flexShrink: 0,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: ativo ? COR.tinta : COR.borda,
                  backgroundColor: ativo ? COR.tinta : '#fff',
                }}
              >
                <Text style={{ color: ativo ? '#fff' : COR.tinta, fontWeight: '600' }}>
                  {c.nome_conteudo}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
        {podeRolar && (
          <Seta direcao="direita" desabilitada={noFim} onPress={() => rolar(1)} />
        )}
      </View>
    </View>
  )
}

export default function Conteudos() {
  const [niveis, setNiveis] = useState<Nivel[]>([])
  const [carregandoNiveis, setCarregandoNiveis] = useState(true)
  const [nivel, setNivel] = useState<Nivel | null>(null)
  const [conteudos, setConteudos] = useState<Conteudo[]>([])
  const [carregandoConteudos, setCarregandoConteudos] = useState(false)
  const [conteudo, setConteudo] = useState<Conteudo | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [carregandoPdf, setCarregandoPdf] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Contadores para ignorar respostas antigas se a pessoa clicar rápido em outra opção
  const reqNivel = useRef(0)
  const reqPdf = useRef(0)

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
    reqPdf.current++ // cancela qualquer PDF que ainda esteja carregando
    setNivel(n)
    setConteudo(null)
    setPdfUrl(null)
    setCarregandoPdf(false)
    setConteudos([])
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

  async function abrirConteudo(c: Conteudo) {
    const req = ++reqPdf.current
    setConteudo(c)
    setPdfUrl(null)
    setErro(null)

    if (!c.pdf_path) {
      setCarregandoPdf(false)
      return setErro('Este conteúdo ainda não tem PDF.')
    }

    setCarregandoPdf(true)
    // O bucket é privado: gera um link temporário (1 hora) só para esta pessoa
    const { data, error } = await supabase.storage
      .from('conteudos')
      .createSignedUrl(c.pdf_path, 3600)

    if (req !== reqPdf.current) return
    setCarregandoPdf(false)

    if (error || !data) {
      console.warn('Falha ao gerar link do PDF:', c.pdf_path, error?.message)
      // O Storage responde 400 "Object not found" quando o arquivo não existe
      // com esse nome exato no bucket (ou quando a policy de leitura não deixa ver).
      const naoAchou = /not.?found/i.test(error?.message ?? '')
      return setErro(
        naoAchou
          ? 'PDF não encontrado no armazenamento.' +
              (__DEV__ ? ` Caminho procurado: ${c.pdf_path}` : '')
          : 'Não foi possível carregar o PDF. Tente novamente.'
      )
    }
    setPdfUrl(data.signedUrl)

    // Registra o acesso (tabela log_acesso_aluno); falha aqui não atrapalha a leitura
    void supabase
      .from('log_acesso_aluno')
      .insert({ id_nivel: nivel?.id_nivel, id_conteudo: c.id_conteudo })
      .then(() => {})
  }

  const compacto = !!nivel // depois de escolher, os cards de nível encolhem
  const grupos = agruparPorMateria(conteudos)

  return (
    <View style={{ flex: 1, padding: 16, gap: 14, backgroundColor: COR.fundo }}>
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
                  backgroundColor: ativo ? COR.tinta : '#fff',
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
          Escolha um nível para ver os conteúdos disponíveis.
        </Text>
      )}

      {/* 2) Seções de conteúdo, uma por matéria (cada uma rola para o lado) */}
      {nivel &&
        (carregandoConteudos ? (
          <ActivityIndicator />
        ) : conteudos.length === 0 && !erro ? (
          <Text style={{ color: COR.suave }}>
            Ainda não há conteúdos no nível {nivel.codigo_nivel}.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {grupos.map((g) => (
              <Faixa
                key={g.titulo}
                titulo={g.titulo}
                itens={g.itens}
                ativoId={conteudo?.id_conteudo}
                onAbrir={abrirConteudo}
              />
            ))}
          </View>
        ))}

      {erro && !conteudo && <Text style={{ color: COR.erro }}>{erro}</Text>}

      {/* 3) Área do PDF */}
      {nivel && !carregandoConteudos && conteudos.length > 0 && (
        <View
          style={{
            flex: 1,
            minHeight: 260,
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: COR.leitor,
          }}
        >
          {carregandoPdf ? (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : pdfUrl ? (
            <PdfViewer key={pdfUrl} url={pdfUrl} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
              <Text
                style={{
                  textAlign: 'center',
                  color: conteudo && erro ? '#ffb4ab' : '#c9cce3',
                }}
              >
                {conteudo && erro
                  ? erro
                  : 'Escolha um conteúdo para abrir o PDF aqui.'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}
