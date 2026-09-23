import { supabase } from './supabase'

export type RespostaSimulado = {
  id_questao: number
  alternativa: 'A' | 'B' | 'C' | 'D' | 'E'
}

export type ResultadoFinal = {
  pontuacao: number // 0 a 100
  acertos: number
  total: number
}

// Começa uma tentativa e devolve o id_resultado.
// Se, por uma corrida rara (duas abas/dispositivos ao mesmo tempo), o banco
// recusar por já existir um simulado EM_ANDAMENTO (índice único), reaproveita
// esse mesmo em vez de falhar.
export async function iniciarSimulado(idSimulado: number): Promise<number> {
  const { data, error } = await supabase
    .from('resultado_simulado')
    .insert({ id_simulado: idSimulado })
    .select('id_resultado')
    .single()

  if (!error) return data.id_resultado

  if (error.code === '23505') {
    const existente = await buscarSimuladoEmAndamento()
    if (existente) return existente
  }
  throw error
}

// Retorna o id_resultado do simulado em andamento do aluno logado, se houver
export async function buscarSimuladoEmAndamento(): Promise<number | null> {
  const { data, error } = await supabase
    .from('resultado_simulado')
    .select('id_resultado')
    .eq('status', 'EM_ANDAMENTO')
    .order('data_inicio', { ascending: false })
    .limit(1)
  if (error || !data || data.length === 0) return null
  return data[0].id_resultado
}

// Envia todas as respostas de uma vez; a correção acontece no servidor
export async function finalizarSimulado(
  idResultado: number,
  respostas: RespostaSimulado[]
): Promise<ResultadoFinal> {
  const { data, error } = await supabase.rpc('finalizar_simulado', {
    p_id_resultado: idResultado,
    p_respostas: respostas,
  })
  if (error) throw error
  return data[0]
}
