import { Fragment } from 'react';
import { analisarFormatacao } from '../../lib/formatacao/analisar';
import { safeExternalUrl } from '../../lib/url';
import { CORES, TAMANHOS } from '../../lib/formatacao/vocabulario';

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
 *
 * ── Cor e tamanho: CLASSE de mapa, nunca `style` ──────────────────────────
 *
 * `[25/09]` O nó de cor traz um NOME (`verde`), não um valor (`#39ff14`), e a
 * classe sai de um mapa fechado. `style={{ color: algoDoUsuario }}` seria o
 * caminho curto e a proteção passaria a ser "o React trata CSS malformado" —
 * proteção acidental, que some no dia em que esse texto for parar num e-mail
 * ou num componente que concatene.
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
  // `[25/09]` O negrito NÃO fixa mais a cor.
  //
  // Ele era `text-gray-200`, e isso **matava a cor de dentro**:
  // `[cor=verde]**x**[/cor]` virava `<span verde><strong cinza>` — o cinza,
  // por ser do elemento mais interno, ganhava. O dono relatou como "fica só a
  // cor e o texto fica normal", e estava vendo exatamente isto.
  //
  // Negrito é PESO, não cor. Herdar é o certo: quem decide a cor é a cor.
  if (no.tipo === 'negrito') return <strong className="font-bold">{filhos}</strong>;
  if (no.tipo === 'italico') return <em>{filhos}</em>;
  if (no.tipo === 'tachado') return <s className="opacity-70">{filhos}</s>;
  if (no.tipo === 'sublinhado') return <u>{filhos}</u>;

  // `[25/09]` Cor e tamanho: o nó traz um NOME, e a classe sai de um mapa
  // fechado. Nenhuma string do usuário vira CSS — ele escolhe de uma lista, e
  // o analisador já recusou o que não está nela.
  if (no.tipo === 'cor') {
    return <span className={CORES[no.nome]?.classe}>{filhos}</span>;
  }
  if (no.tipo === 'tamanho') {
    return <span className={TAMANHOS[no.nome]?.classe}>{filhos}</span>;
  }

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
