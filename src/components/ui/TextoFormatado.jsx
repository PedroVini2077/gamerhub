import { Fragment } from 'react';
import { analisarFormatacao } from '../../lib/formatacao/analisar';
import { safeExternalUrl } from '../../lib/url';

/**
 * `[25/09]` Desenha o texto de um post com a formatação que ele pede.
 *
 * ── A propriedade que este arquivo garante ────────────────────────────────
 *
 * **Nenhum HTML é produzido em ponto nenhum.** A árvore vem do
 * `analisarFormatacao` e cada nó vira um elemento React; o texto entra como
 * filho, e o React escapa filho de texto por construção. Escrever
 * `<script>alert(1)</script>` num post faz aparecer, na tela, a frase
 * `<script>alert(1)</script>`.
 *
 * Por isso aqui não existe `dangerouslySetInnerHTML` — e não é disciplina, é
 * que não há string de HTML para passar para ele.
 *
 * ── O único ponto perigoso, e ele tem dono ────────────────────────────────
 *
 * O `href` de um link. Marcação não pode injetar script, mas `href` pode:
 * `[clique](javascript:alert(1))`. Todo link passa por `safeExternalUrl`, que
 * só devolve `http:` e `https:` — a mesma função que fechou um XSS armazenado
 * real deste projeto em agosto.
 *
 * URL recusada **não some**: vira texto. Sumir seria o site comendo o que a
 * pessoa escreveu sem dizer nada (§1.5); virar texto mostra exatamente o que
 * ela digitou e não clica em lugar nenhum.
 */

/** Um nó de trecho (negrito, itálico, tachado, link, texto). */
function Trecho({ no }) {
  if (no.tipo === 'texto') return no.valor;

  if (no.tipo === 'link') {
    const href = safeExternalUrl(no.url);
    // Recusado vira TEXTO, com a marcação original à mostra.
    if (!href) return `[${no.texto}](${no.url})`;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="text-neon-green hover:underline break-words">
        {no.texto}
      </a>
    );
  }

  const filhos = <Filhos nos={no.filhos} />;
  if (no.tipo === 'negrito') return <strong className="text-gray-200">{filhos}</strong>;
  if (no.tipo === 'italico') return <em>{filhos}</em>;
  if (no.tipo === 'tachado') return <s className="opacity-70">{filhos}</s>;

  // Tipo desconhecido não vira palpite: mostra o que dá para mostrar. Um
  // `else` que escolhesse uma tag por conta própria seria fallback silencioso.
  return filhos;
}

function Filhos({ nos }) {
  return nos.map((no, i) => <Trecho key={i} no={no} />);
}

/**
 * @param {object} p
 * @param {string} p.texto      o conteúdo cru do post, como foi digitado
 * @param {string} [p.className] classes do parágrafo, para o card decidir o tom
 */
export default function TextoFormatado({ texto, className = '' }) {
  const blocos = analisarFormatacao(texto);
  if (!blocos.length) return null;

  return (
    <div className="space-y-2">
      {blocos.map((bloco, i) => {
        if (bloco.tipo === 'lista') {
          return (
            <ul key={i} className={`list-disc pl-5 space-y-0.5 ${className}`}>
              {bloco.itens.map((item, j) => (
                <li key={j}><Filhos nos={item} /></li>
              ))}
            </ul>
          );
        }
        if (bloco.tipo === 'citacao') {
          return (
            <blockquote key={i}
              className={`border-l-2 border-neon-green/40 pl-3 italic ${className}`}>
              {bloco.linhas.map((linha, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  <Filhos nos={linha} />
                </Fragment>
              ))}
            </blockquote>
          );
        }
        // Parágrafo: `whitespace-pre-line` preserva a quebra simples que a
        // pessoa digitou — ela escreveu Enter e espera ver Enter.
        return (
          <p key={i} className={`whitespace-pre-line ${className}`}>
            <Filhos nos={bloco.filhos} />
          </p>
        );
      })}
    </div>
  );
}
