import { Scale } from 'lucide-react';
import { BLOCOS, ATUALIZADO_EM } from '../components/termos/conteudoDosTermos';
import PaginaDeConteudo from '../components/conteudo/PaginaDeConteudo';

/**
 * Os Termos de Uso — o terceiro documento, e o único que fala de CONTRATO.
 *
 * `/privacidade` responde o que fazemos com os dados; `/regras` responde o que
 * se pode publicar; este responde de quem é o conteúdo, quando a conta é
 * encerrada e que garantia não existe.
 *
 * Pública como as outras duas: ninguém deveria precisar criar conta para
 * descobrir o que está aceitando ao criar conta.
 */
export default function Termos() {
  return (
    <PaginaDeConteudo
      eyebrow="Termos de uso"
      icone={Scale}
      titulo="As regras"
      destaque="do acordo."
      rodapeDoTitulo={`Atualizado em ${ATUALIZADO_EM} · escrito a partir do que o `
        + 'site realmente faz, e não de um modelo copiado.'}
      blocos={BLOCOS}
    />
  );
}
