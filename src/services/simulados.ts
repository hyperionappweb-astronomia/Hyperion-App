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

// Começa uma tentativa e devolve o id_resultado
export async function iniciarSimulado(idSimulado: number): Promise<number> {
  const { data, error } = await supabase
    .from('resultado_simulado')
    .insert({ id_simulado: idSimulado })
    .select('id_resultado')
    .single()
  if (error) throw error
  return data.id_resultado
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