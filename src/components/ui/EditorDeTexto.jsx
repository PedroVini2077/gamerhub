import { useRef, useState, useId, useMemo } from 'react';
import { Bold, Italic, Underline, Strikethrough, List, Quote, Link2, Palette, Type } from 'lucide-react';
import {
  MARCACOES, CORES, TAMANHOS, envolverCor, envolverTamanho, RECURSOS_COMPLETOS,
} from '../../lib/formatacao/vocabulario';
import { analisarFormatacao, temFormatacao } from '../../lib/formatacao/analisar';
import TextoFormatado from './TextoFormatado';

/**
 * `[25/09]` O EDITOR — barra de ferramentas sobre um `textarea`, com prévia.
 *
 * ── Por que NÃO é WYSIWYG, agora COM O NÚMERO ─────────────────────────────
 *
 * O dono pediu que a formatação acontecesse "na hora", sem marcador nenhum no
 * campo: *"fica um comando em html no campo, pra mim isso deixa poluído"*.
 * Formatar DENTRO do campo exige `contenteditable` — não há meio-termo, e o
 * motivo é mecânico: a alternativa barata (uma camada desenhada por cima de um
 * `textarea` transparente, o truque do CodeMirror) só funciona enquanto cada
 * caractere ocupar o MESMO espaço nas duas camadas. Cor e sublinhado passam;
 * **negrito e tamanho não** — e o cursor começa a cair no lugar errado.
 *
 * Então a conta é `contenteditable`, e ela foi MEDIDA (§0.3) em vez de
 * estimada. Lexical com o mínimo (rich-text, histórico, onChange), React já
 * descontado:
 *
 *   editor de hoje ....  7 kB brutos  ·   3 kB gzip
 *   Lexical .......... 331 kB brutos · 110 kB gzip     -> 46x
 *
 * O número bruto é o que importa para travamento (§0.3), e 331 kB é metade de
 * uma cena 3D que este projeto acabou de remover por pesar demais.
 *
 * Há ainda a superfície: `contenteditable` aceita COLAGEM de HTML arbitrário.
 * Daria para contê-la — o estado do Lexical é uma árvore, e dava para
 * serializar de volta para a marcação antes de salvar —, mas aí a defesa
 * passaria a ser "o normalizador da biblioteca é completo", que é a postura de
 * sanitizador que a fase 5 recusou de propósito.
 *
 * ── O que entrou no lugar: a prévia AO VIVO ───────────────────────────────
 *
 * A prévia era um botão que TROCAVA o campo pelo resultado — ou se escrevia,
 * ou se via. Agora ela fica embaixo, atualizando a cada tecla, e **só aparece
 * quando o texto tem formatação**: em texto puro seria o mesmo texto duas
 * vezes, que é a mesma poluição pelo outro lado.
 *
 * Não é o que ele pediu, é o que cabe: o marcador continua no campo, mas ele
 * vê o resultado acontecer enquanto digita, sem clicar em nada.
 *
 * ── O que "a barra escreve" significa, e o cuidado que exige ──────────────
 *
 * Embrulhar a seleção é fácil; **devolver o cursor para o lugar certo** é o
 * que separa um editor utilizável de um que irrita. Depois de aplicar, a
 * seleção volta para o texto que estava selecionado — sem isso, aplicar
 * negrito e continuar digitando escreveria fora da marca.
 *
 * ── `recursos` — o mesmo editor, com menos poder ──────────────────────────
 *
 * Pedido do dono: *"nem tudo que tem na hora de postar precisa ter nos
 * comentários"*. Comentário é conversa, não publicação: cor e tamanho ali
 * transformariam a discussão numa disputa de quem grita mais alto. A lista
 * vem de fora, e o padrão é o conjunto completo.
 */

const ICONES = {
  negrito: Bold, italico: Italic, sublinhado: Underline, tachado: Strikethrough,
};

function Botao({ icone: Icone, titulo, onClick, ativo = false }) {
  return (
    <button type="button" onClick={onClick} title={titulo} aria-label={titulo}
      className={`p-1.5 rounded transition-colors ${
        ativo ? 'text-neon-green bg-neon-green/10' : 'text-gray-500 hover:text-neon-green'
      }`}>
      <Icone size={15} />
    </button>
  );
}

export default function EditorDeTexto({
  value, onChange, placeholder, maxLength = 1000, rows = 3,
  recursos = RECURSOS_COMPLETOS, id, onKeyDown, autoFocus = false,
}) {
  const areaRef = useRef(null);
  const [paleta, setPaleta] = useState(null); // 'cor' | 'tamanho' | null
  const idGerado = useId();
  const idDoCampo = id ?? `editor-${idGerado}`;
  const tem = (r) => recursos.includes(r);

  // A decisão de mostrar a prévia sai da ÁRVORE, não de procurar asterisco no
  // texto: recurso novo passa a contar sozinho (§4, fonte única).
  const mostrarPrevia = useMemo(() => temFormatacao(analisarFormatacao(value)), [value]);

  /**
   * Embrulha a seleção — e devolve o cursor para dentro dela.
   *
   * Sem seleção, insere os marcadores e põe o cursor no meio: a pessoa clica
   * em negrito e já digita em negrito, que é o que ela espera.
   */
  function envolver({ abre, fecha }) {
    const area = areaRef.current;
    if (!area) return;
    const { selectionStart: i, selectionEnd: f } = area;
    const selecionado = value.slice(i, f);
    const novo = value.slice(0, i) + abre + selecionado + fecha + value.slice(f);
    if (novo.length > maxLength) return;   // não estoura o limite pelo atalho
    onChange(novo);
    setPaleta(null);
    // O React reescreve o valor; o cursor tem de ser reposto DEPOIS disso.
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(i + abre.length, i + abre.length + selecionado.length);
    });
  }

  /** Prefixo de linha (lista, citação): age na linha onde o cursor está. */
  function prefixarLinha(prefixo) {
    const area = areaRef.current;
    if (!area) return;
    const i = area.selectionStart;
    const inicioDaLinha = value.lastIndexOf('\n', i - 1) + 1;
    const novo = value.slice(0, inicioDaLinha) + prefixo + value.slice(inicioDaLinha);
    if (novo.length > maxLength) return;
    onChange(novo);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(i + prefixo.length, i + prefixo.length);
    });
  }

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-0.5 mb-1.5 pb-1.5 border-b border-dark-500">
        {['negrito', 'italico', 'sublinhado', 'tachado'].filter(tem).map((r) => (
          <Botao key={r} icone={ICONES[r]} titulo={MARCACOES[r].rotulo}
            onClick={() => envolver(MARCACOES[r])} />
        ))}

        {(tem('cor') || tem('tamanho')) && <span className="w-px h-4 bg-dark-400 mx-1" />}
        {tem('cor') && (
          <Botao icone={Palette} titulo="Cor do texto" ativo={paleta === 'cor'}
            onClick={() => setPaleta((p) => (p === 'cor' ? null : 'cor'))} />
        )}
        {tem('tamanho') && (
          <Botao icone={Type} titulo="Tamanho do texto" ativo={paleta === 'tamanho'}
            onClick={() => setPaleta((p) => (p === 'tamanho' ? null : 'tamanho'))} />
        )}

        {(tem('lista') || tem('citacao') || tem('link')) && <span className="w-px h-4 bg-dark-400 mx-1" />}
        {tem('lista') && <Botao icone={List} titulo="Lista" onClick={() => prefixarLinha('- ')} />}
        {tem('citacao') && <Botao icone={Quote} titulo="Citação" onClick={() => prefixarLinha('> ')} />}
        {tem('link') && (
          <Botao icone={Link2} titulo="Link"
            onClick={() => envolver({ abre: '[', fecha: '](https://)' })} />
        )}
      </div>

      {/* A paleta só existe quando pedida: barra sempre aberta com 6 bolinhas
          de cor rouba a atenção de quem só quer escrever. */}
      {paleta === 'cor' && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Object.entries(CORES).map(([nome, { rotulo, amostra }]) => (
            <button key={nome} type="button" title={rotulo} aria-label={`Cor ${rotulo}`}
              onClick={() => envolver(envolverCor(nome))}
              className="w-5 h-5 rounded-full border border-dark-400 hover:scale-110 transition-transform"
              style={{ backgroundColor: amostra }} />
          ))}
        </div>
      )}
      {paleta === 'tamanho' && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Object.entries(TAMANHOS).map(([nome, { rotulo }]) => (
            <button key={nome} type="button" onClick={() => envolver(envolverTamanho(nome))}
              className="tag tag-cyan cursor-pointer text-[10px]">{rotulo}</button>
          ))}
        </div>
      )}

      <textarea
        ref={areaRef} id={idDoCampo} aria-label={placeholder}
        className="input-gamer resize-none w-full" rows={rows}
        placeholder={placeholder} value={value} maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        // O comentário envia com Enter. Perder isso seria regressão de uso —
        // e o roteiro de responder depende do caminho de teclado.
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
      />

      {/* Sem `aria-live`: isto muda a cada tecla, e anunciar cada tecla a quem
          usa leitor de tela seria tortura. É região nomeada, visitável. */}
      {mostrarPrevia && (
        <div className="mt-1.5" aria-label="Como vai ficar">
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-600 mb-1">
            Como vai ficar
          </p>
          <div className="rounded-lg border border-dark-500 bg-dark-800/60 px-3 py-2 overflow-x-hidden">
            <TextoFormatado texto={value} className="text-sm text-gray-400 leading-relaxed" />
          </div>
        </div>
      )}
    </div>
  );
}
