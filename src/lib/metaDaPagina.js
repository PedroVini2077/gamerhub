/**
 * `[17/09]` Título, descrição e canonical por PÁGINA — Etapa 2 do Prompt 1.
 *
 * ── O problema, medido ──────────────────────────────────────────────────────
 *
 * O site é uma aplicação de página única com um `index.html` estático. Isso
 * significa que as **seis** páginas públicas serviam o mesmo `<title>` e a
 * mesma `description`:
 *
 *     /            "GamerHub — a comunidade gamer brasileira"
 *     /sobre       "GamerHub — a comunidade gamer brasileira"
 *     /termos      "GamerHub — a comunidade gamer brasileira"
 *     /privacidade "GamerHub — a comunidade gamer brasileira"
 *     ...
 *
 * Para quem indexa, seis endereços que se anunciam igual **são a mesma
 * página**. Ele escolhe um e trata os outros como duplicata — e quem procura
 * "termos de uso do GamerHub" pode cair na landing.
 *
 * E não havia `canonical` nenhum: `?utm_source=…`, `?fbclid=…` e os domínios de
 * pré-visualização da Vercel viram endereços diferentes do mesmo conteúdo.
 *
 * ── Por que NÃO entrou biblioteca ───────────────────────────────────────────
 *
 * Pedido dele, na letra: *"não introduza uma biblioteca de SEO apenas para isso
 * se não houver necessidade"*. `react-helmet-async` resolveria — e traria uma
 * dependência, um provider no topo da árvore e uma API nova, para fazer três
 * `document.*` que o navegador já expõe.
 *
 * ── O LIMITE DISTO, e ele é real ────────────────────────────────────────────
 *
 * Isto roda **no navegador**, depois que o JavaScript executa.
 *
 * | Quem lê | Enxerga o título por página? |
 * | --- | --- |
 * | Google | **sim** — ele renderiza JS, ainda que num segundo passe |
 * | rastreador que não executa JS | **não** — vê o `index.html` |
 * | WhatsApp, Discord, Twitter (cartão de link) | **não**, e por isso o `og:` continua ESTÁTICO no `index.html` |
 *
 * Essa última linha é decisão, não esquecimento: raspador de cartão social
 * **não roda JavaScript**. Um `og:title` mexido aqui nunca chegaria neles, e
 * trocá-lo dinamicamente só criaria a ilusão de que o cartão muda por página.
 * A única forma de resolver de verdade seria renderizar no servidor — e isso é
 * mudança de arquitetura, não ajuste de SEO.
 *
 * O ganho real: o Google passa a distinguir as seis páginas, e o canonical
 * passa a existir para todo mundo.
 */

const DOMINIO = 'https://gamerhub-nine.vercel.app';

/**
 * O catálogo das páginas PÚBLICAS.
 *
 * Mapa explícito, e não `?? padrao` (§4): rota que não está aqui **não** recebe
 * meta própria, e isso é proposital — página atrás de login não deve se
 * anunciar para quem indexa. O teste de contrato confere que toda rota pública
 * do router tem entrada, então esquecer uma passa a falhar.
 */
export const META = {
  '/': {
    titulo: 'GamerHub — a comunidade gamer brasileira',
    descricao: 'Rede social gamer brasileira: feed de dicas, curiosidades e news, '
      + 'mural da comunidade, lives com chat ao vivo, keys grátis e sistema de ranks por XP.',
  },
  '/sobre': {
    titulo: 'Sobre o GamerHub — quem fez e por que existe',
    descricao: 'A história do GamerHub: por que ele foi criado, como foi construído '
      + 'e o que ele quer ser para quem joga no Brasil.',
  },
  '/contato': {
    titulo: 'Falar com a equipe — GamerHub',
    descricao: 'Formulário de contato do GamerHub: dúvida sobre a conta, relato de bug, '
      + 'denúncia, privacidade ou pedido de revisão de banimento.',
  },
  '/regras': {
    titulo: 'Regras da comunidade — GamerHub',
    descricao: 'O que é permitido e o que leva à moderação no GamerHub: conduta, '
      + 'conteúdo proibido e como funcionam as punições.',
  },
  '/termos': {
    titulo: 'Termos de uso — GamerHub',
    descricao: 'As condições de uso do GamerHub: o que você pode fazer na plataforma, '
      + 'suas responsabilidades e as nossas.',
  },
  '/privacidade': {
    titulo: 'Política de privacidade — GamerHub',
    descricao: 'Quais dados o GamerHub coleta de verdade, para que servem, '
      + 'por quanto tempo ficam guardados e como pedir a exclusão.',
  },
};

/** Escreve (ou cria) uma `<meta name="...">` no `<head>`. */
function porNome(nome, valor) {
  let el = document.head.querySelector(`meta[name="${nome}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', nome);
    document.head.appendChild(el);
  }
  el.setAttribute('content', valor);
}

/**
 * Aplica o título, a descrição e o canonical da rota.
 *
 * O canonical usa só o CAMINHO — sem query e sem hash. É o ponto inteiro dele:
 * `/sobre?utm_source=twitter` e `/sobre` são a mesma página, e sem isto viram
 * dois endereços concorrendo entre si.
 */
export function aplicarMeta(caminho) {
  const meta = META[caminho];
  if (!meta) return false;

  document.title = meta.titulo;
  porNome('description', meta.descricao);

  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', DOMINIO + caminho);
  return true;
}

export { DOMINIO };
