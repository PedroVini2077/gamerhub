/**
 * As peças de videogame que flutuam no fundo do site logado.
 *
 * ── Por que SVG desenhado à mão, e não ícone de biblioteca ──────────────────
 *
 * O dono foi explícito: *"quando falo emoji, não é literalmente emoji do
 * teclado, é feito por svg ou o jeito que vc faz"*. Emoji do teclado muda de
 * desenho em cada sistema — o mesmo caractere vira uma coisa no Android, outra
 * no iPhone, outra no Windows. Num fundo de cena isso é ruído: a identidade do
 * site passaria a depender da fonte que o aparelho instalou.
 *
 * Ícone de biblioteca resolveria o desenho, mas não o peso: o `lucide-react`
 * não tem controle de videogame nem moeda de fase, e puxar um segundo pacote
 * de ícones por causa de enfeite é caro para o que entrega.
 *
 * Estes são caminhos SVG curtos, sem preenchimento, escritos aqui. Cada um
 * pesa algumas centenas de bytes e herda a cor de quem o desenha
 * (`currentColor`), então a mesma peça serve todas as seções.
 *
 * ── Contorno, e não preenchimento ──────────────────────────────────────────
 *
 * Peça sólida no fundo compete com o texto. Contorno fino em `currentColor`
 * com opacidade baixa lê como cenário — é a mesma escolha do `FundoAnimado`
 * das páginas públicas, e mantém as duas camadas parentes sem serem iguais.
 */

/** Todos desenhados numa caixa 24×24, para poderem ser trocados entre si. */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

/** Controle de videogame — o símbolo mais direto do que este site é. */
export function Controle() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path {...P} d="M7 8h10a4 4 0 0 1 3.9 3.1l1 4.4A2.6 2.6 0 0 1 19.4 19c-1 0-1.6-.6-2.2-1.3L16 16H8l-1.2 1.7C6.2 18.4 5.6 19 4.6 19a2.6 2.6 0 0 1-2.5-3.5l1-4.4A4 4 0 0 1 7 8Z" />
      <path {...P} d="M7.5 11.5v2.2M6.4 12.6h2.2" />
      <circle {...P} cx="16.4" cy="12.2" r=".7" />
      <circle {...P} cx="17.8" cy="13.8" r=".7" />
    </svg>
  );
}

/** Direcional em cruz — o d-pad. */
export function Direcional() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path {...P} d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" />
    </svg>
  );
}

/** Moeda de fase, com o brilho de sempre. */
export function Moeda() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <circle {...P} cx="12" cy="12" r="9" />
      <circle {...P} cx="12" cy="12" r="5.5" />
      <path {...P} d="M12 8.5v7" />
    </svg>
  );
}

/** Coração de vida, em pixel — não o coração arredondado de rede social. */
export function VidaExtra() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path {...P} d="M6 5h4v2h4V5h4v4h2v4h-2v2h-2v2h-2v2h-4v-2H8v-2H6v-2H4V9h2V5Z" />
    </svg>
  );
}

/** Troféu — o ranking é uma das cinco seções do site. */
export function Trofeu() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path {...P} d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path {...P} d="M7 6H4.5a2.5 2.5 0 0 0 2.5 2.5M17 6h2.5a2.5 2.5 0 0 1-2.5 2.5" />
      <path {...P} d="M12 14v3m-3 3h6" />
    </svg>
  );
}

/** Nave de jogo de tiro, vista de cima. */
export function Nave() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path {...P} d="M12 3l3 8v6l-3-2-3 2v-6l3-8Z" />
      <path {...P} d="M9 12l-4 3v3l4-2M15 12l4 3v3l-4-2" />
    </svg>
  );
}

/** Raio — a assinatura do GamerHub, que já é o ícone da marca. */
export function Raio() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path {...P} d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

/** Balão de fala — o mural e o chat das lives. */
export function Balao() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path {...P} d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4v-4a2 2 0 0 1-1-2V6Z" />
      <path {...P} d="M8 9h8M8 12h5" />
    </svg>
  );
}

/** Chave — as keys de jogo. */
export function Chave() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <circle {...P} cx="7.5" cy="12" r="3.5" />
      <path {...P} d="M11 12h9M17 12v3M20 12v2.5" />
    </svg>
  );
}

/** Fliperama — o gabinete, para o feed. */
export function Fliperama() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path {...P} d="M6 3h12v18H6V3Z" />
      <path {...P} d="M8 6h8v5H8V6Z" />
      <path {...P} d="M9 14h2M14 14h1M9 17h6" />
    </svg>
  );
}
