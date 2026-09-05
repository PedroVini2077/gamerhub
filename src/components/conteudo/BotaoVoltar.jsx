import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { caminhoInternoSeguro } from '../../lib/url';

/**
 * O "Voltar" das páginas de conteúdo — e ele volta para ONDE A PESSOA ESTAVA.
 *
 * ── O bug que ele conserta ──────────────────────────────────────────────────
 *
 * Relato do dono em 05/09: *"na aba de cadastro, os links pra ler os termos, a
 * privacidade e tal... quando eu volto, ao invés de eu voltar ao cadastro
 * (mesmo lugar que eu cliquei no link), eu volto direto pra landing"*.
 *
 * A causa era literal: o botão era `<Link to="/">`. Ele **não voltava** — ele
 * navegava para a landing, sempre, viesse a pessoa de onde viesse. Funcionava
 * por acaso para quem chegava do rodapé da landing, e errava para todo o resto.
 *
 * ── Por que não é só trocar por `navigate(-1)` ──────────────────────────────
 *
 * Porque nem sempre existe um "-1". Estas páginas são públicas e abrem por link
 * direto: alguém que cola `/termos` no navegador, ou que abre em ABA NOVA — que
 * é o que os links do formulário de cadastro fazem de propósito, para não
 * perder o que já foi digitado. Nesses casos o histórico está vazio, e
 * `navigate(-1)` sai do site inteiro, ou não faz nada.
 *
 * **E o caso do dono era justamente esse.** Ele clicou nos links de dentro do
 * cadastro, que abrem `target="_blank"`. Trocar por `navigate(-1)` teria
 * consertado só os links do rodapé da landing e deixado o relato dele de pé —
 * por isso a origem viaja explicitamente, num `?de=`.
 *
 * ── A ordem das três respostas ──────────────────────────────────────────────
 *
 *   1. `?de=` VALIDADO  -> a origem foi dita. Vence, inclusive sobre histórico:
 *                          é a única resposta que funciona em aba nova.
 *   2. tem histórico    -> `navigate(-1)`, que preserva a rolagem de graça.
 *   3. nada disso       -> a landing, que é o destino honesto de quem colou a
 *                          URL no navegador.
 *
 * `useLocation().key` responde o caso 2 sem adivinhação: o React Router dá a
 * chave `'default'` para a PRIMEIRA entrada de uma sessão de navegação.
 *
 * ── O `?de=` é entrada de usuário, e é tratado como tal ─────────────────────
 *
 * Obedecer a ele cegamente seria **redirecionamento aberto**: qualquer pessoa
 * monta `…/termos?de=//site-falso` e manda o link; a vítima confere o domínio
 * (é o nosso), clica em "Voltar" e sai do site. `caminhoInternoSeguro`
 * (`lib/url.js`) é quem barra, e a trava está em `voltarNaoEhRedirecionador`.
 */
export default function BotaoVoltar({ className = '' }) {
  const navigate = useNavigate();
  const { key } = useLocation();
  const [params] = useSearchParams();

  const origem = caminhoInternoSeguro(params.get('de'));
  const temHistorico = key !== 'default';
  const classes = 'inline-flex items-center gap-2 text-xs font-mono '
    + `text-gray-300 hover:text-neon-green transition-colors ${className}`;

  // `<Link>` de verdade, e não um botão, para o clique do meio e o "abrir em
  // nova aba" continuarem funcionando como qualquer link.
  if (origem || !temHistorico) {
    return (
      <Link to={origem || '/'} className={classes}>
        <ArrowLeft size={14} /> Voltar
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => navigate(-1)} className={classes}>
      <ArrowLeft size={14} /> Voltar
    </button>
  );
}
