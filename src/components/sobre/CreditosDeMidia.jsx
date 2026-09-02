import { safeExternalUrl } from '../../lib/url';

/**
 * Os créditos de mídia de terceiros.
 *
 * ── Isto não é cortesia; é o que a licença EXIGE ────────────────────────────
 *
 * A trilha da landing é CC BY 4.0. "BY" quer dizer atribuição obrigatória:
 * usar sem crédito visível é usar sem licença. Crédito escondido num
 * comentário de código não cumpre — tem que estar onde uma pessoa vê.
 *
 * O padrão seguido é o TASL, recomendado pela própria Creative Commons:
 * **T**ítulo, **A**utor, **S**ource (origem) e **L**icença, cada um com link
 * quando existe link.
 *
 * ── Por que uma lista, e não um parágrafo escrito à mão ─────────────────────
 *
 * Porque vai crescer. No dia em que entrar uma segunda música, um ícone ou uma
 * fonte licenciada, o risco é alguém acrescentar o arquivo e esquecer o
 * crédito — e aí o site passa a violar uma licença sem ninguém perceber. Uma
 * lista declarada tem um lugar óbvio para a linha nova, e um teste consegue
 * conferir que todo item tem os quatro campos.
 */
export default function CreditosDeMidia({ itens }) {
  return (
    <ul className="space-y-4">
      {itens.map((c) => (
        <li key={c.titulo} className="text-sm font-body text-gray-400">
          <span className="font-display text-white">{c.titulo}</span>
          <span className="text-gray-600"> — por </span>
          <span className="text-gray-300">{c.autor}</span>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono">
            <a
              href={safeExternalUrl(c.origem)}
              target="_blank" rel="noopener noreferrer"
              className="text-neon-green hover:underline"
            >
              origem
            </a>
            <a
              href={safeExternalUrl(c.licencaUrl)}
              target="_blank" rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-300"
            >
              {c.licenca}
            </a>
            {c.adaptacao && (
              /* Dizer o que foi mudado também é parte do CC-BY: a licença pede
                 que a adaptação seja indicada. */
              <span className="text-gray-600">{c.adaptacao}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
