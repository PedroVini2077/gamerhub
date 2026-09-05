import { ShieldCheck } from 'lucide-react';
import { BLOCOS, ATUALIZADO_EM } from '../components/privacidade/conteudoDaPrivacidade';
import PaginaDeConteudo from '../components/conteudo/PaginaDeConteudo';

/**
 * A política de privacidade — pública, e escrita a partir do que o sistema
 * REALMENTE faz (`docs/PRIVACIDADE.md`), não de um modelo copiado.
 *
 * Fica fora do `RequireAuth` de propósito: ninguém deveria precisar criar
 * conta para descobrir o que acontece com os dados dela se criar.
 */
export default function Privacidade() {
  return (
    <PaginaDeConteudo
      eyebrow="Privacidade"
      icone={ShieldCheck}
      titulo="Seus dados,"
      destaque="sem letra miúda."
      rodapeDoTitulo={`Atualizado em ${ATUALIZADO_EM} · escrito a partir do que o `
        + 'site realmente faz, e conferido no código.'}
      blocos={BLOCOS}
    />
  );
}
