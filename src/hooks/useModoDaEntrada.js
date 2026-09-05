import { useSearchParams } from 'react-router-dom';

/**
 * A aba da tela de entrada — e ela VIVE NA URL, não no estado do React.
 *
 * ── O relato que produziu isto (05/09) ──────────────────────────────────────
 *
 * *"quando eu volto [dos termos], ao invés de eu voltar ao cadastro (mesmo lugar
 * que eu cliquei no link), eu volto direto pra landing… o navegador deve gravar
 * onde eu estava"*.
 *
 * A metade do "volta pra landing" era o botão Voltar preso a `/`
 * (`components/conteudo/BotaoVoltar.jsx`). Esta é a outra metade: mesmo voltando
 * para `/login`, a aba renascia em `login`, porque **estado do React morre na
 * navegação**. Quem sobrevive à ida e à volta é a URL.
 *
 * De brinde, `/login?modo=cadastro` passou a ser um link compartilhável, e
 * recarregar a página deixou de jogar a pessoa na aba errada.
 *
 * ── O `|| 'login'` NÃO é fallback silencioso ────────────────────────────────
 *
 * A distinção do §4 é sobre a ORIGEM do valor. `?modo=` vem de fora: qualquer
 * pessoa digita o que quiser ali, e a tela de entrada é a resposta honesta para
 * *"não entendi o que você pediu"*. O que o §4 proíbe é o **sistema** escolher
 * um valor por conta própria quando encontra algo que não conhece — um tipo novo
 * vindo do banco, por exemplo. Parâmetro de URL inválido é entrada de usuário.
 *
 * Os dois mapas são explícitos e um é o inverso do outro de propósito: um valor
 * novo precisa ser escrito nos dois, e esquecer um deles some da URL na hora —
 * que é falha visível, não silenciosa.
 */
const DA_URL = { cadastro: 'register', recuperar: 'forgot' };
const PARA_URL = { register: 'cadastro', forgot: 'recuperar' };

/** @returns {[string, (modo: string) => void]} o modo atual e como trocá-lo. */
export function useModoDaEntrada() {
  const [params, setParams] = useSearchParams();
  const modo = DA_URL[params.get('modo')] || 'login';

  const trocar = (novo) => {
    const naUrl = PARA_URL[novo];
    // `replace` para a troca de aba não empilhar histórico: o botão voltar do
    // navegador tem que sair da tela de entrada, não passear entre as abas.
    setParams(naUrl ? { modo: naUrl } : {}, { replace: true });
  };

  return [modo, trocar];
}
