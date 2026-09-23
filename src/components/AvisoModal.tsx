// Popup de aviso simples (título + mensagem + botão "Entendi").
import { Modal, Pressable, Text, View } from 'react-native'

const COR = {
  tinta: '#1c2050',
  suave: '#5b6080',
  erro: '#b3261e',
}

export default function AvisoModal({
  visible,
  titulo,
  mensagem,
  tipo = 'aviso',
  onFechar,
}: {
  visible: boolean
  titulo: string
  mensagem: string
  tipo?: 'aviso' | 'erro'
  onFechar: () => void
}) {
  const cor = tipo === 'erro' ? COR.erro : COR.tinta

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFechar}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(20,22,40,0.45)',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: cor }}>{titulo}</Text>
          <Text style={{ color: COR.suave, lineHeight: 20 }}>{mensagem}</Text>
          <Pressable
            onPress={onFechar}
            style={{
              marginTop: 8,
              alignSelf: 'flex-end',
              paddingVertical: 10,
              paddingHorizontal: 18,
              borderRadius: 10,
              backgroundColor: cor,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Entendi</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
