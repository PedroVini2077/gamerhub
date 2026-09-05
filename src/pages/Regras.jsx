import { Scale } from 'lucide-react';
import { BLOCOS, LEMA } from '../components/regras/conteudoDasRegras';
import PaginaDeConteudo from '../components/conteudo/PaginaDeConteudo';

/**
 * As regras da comunidade — públicas de propósito.
 *
 * O site oculta conteúdo, suspende e bane desde antes desta página existir, e
 * até agora não havia onde dizer QUAL regra foi quebrada. Punição sem regra
 * escrita parece arbitrária mesmo quando é justa.
 *
 * Pública porque a página de banimento vai apontar para cá, e quem foi punido
 * precisa alcançá-la sem estar logado.
 */
export default function Regras() {
  return (
    <PaginaDeConteudo
      eyebrow="Regras da comunidade"
      icone={Scale}
      titulo="Poucas regras,"
      destaque="e todas com motivo."
      rodapeDoTitulo={LEMA}
      blocos={BLOCOS}
    />
  );
}
