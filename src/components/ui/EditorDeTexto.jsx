import { useRef, useState, useId } from 'react';
import { Bold, Italic, Underline, Strikethrough, List, Quote, Link2, Palette, Type, Eye, PenLine } from 'lucide-react';
import {
  MARCACOES, CORES, TAMANHOS, envolverCor, envolverTamanho, RECURSOS_COMPLETOS,
} from '../../lib/formatacao/vocabulario';
import TextoFormatado from './TextoFormatado';

/**
 * `[25/09]` O EDITOR — barra de ferramentas sobre um `textarea`, com prévia.
 *
 * ── Por que NÃO é um editor WYSIWYG ───────────────────────────────────────
 *
 * O pedido foi "algo mais profissional e sofisticado", com liberdade de cor,
 * tamanho e forma. O caminho clássico seria um `contenteditable` (Slate,
 * TipTap, CKEditor) — e ele traz dois problemas que este projeto não aceita:
 *
 *   dependência   os três pesam centenas de KB num projeto que mede bundle
 *                 por byte (§0.3) e acabou de tirar 708 kB de uma cena 3D
 *   superfície    `contenteditable` produz HTML, e o conteúdo volta a ser
 *                 HTML do usuário — exatamente o que a fase anterior tirou
 *                 do caminho, com trava
 *
 * Aqui a barra **escreve marcação** no texto e a prévia mostra o resultado.
 * É o desenho do GitHub e do Reddit, e ele dá o mesmo resultado prático sem
 * nunca guardar HTML: o que vai para o banco continua sendo texto.
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
  const [previa, setPrevia] = useState(false);
  const [paleta, setPaleta] = useState(null); // 'cor' | 'tamanho' | null
  const idGerado = useId();
  const idDoCampo = id ?? `editor-${idGerado}`;
  const tem = (r) => recursos.includes(r);

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

        <div className="ml-auto">
          <Botao icone={previa ? PenLine : Eye} titulo={previa ? 'Voltar a escrever' : 'Ver como vai ficar'}
            ativo={previa} onClick={() => setPrevia((p) => !p)} />
        </div>
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

      {previa ? (
        <div className="input-gamer min-h-[76px] overflow-x-hidden" aria-label="Prévia do texto">
          {value.trim()
            ? <TextoFormatado texto={value} className="text-sm text-gray-400 leading-relaxed" />
            : <p className="text-sm text-gray-600 font-mono">Nada para mostrar ainda.</p>}
        </div>
      ) : (
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
      )}
    </div>
  );
}
