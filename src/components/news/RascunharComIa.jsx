import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Check, X, AlertTriangle } from 'lucide-react';
import { rascunharComIa, MINIMO_DE_NOTAS, lacunasDoRascunho } from '../../services/newsIaService';

/**
 * `[25/09]` RASCUNHAR COM IA — e a palavra que manda é "rascunhar".
 *
 * ── O desenho, em uma frase ───────────────────────────────────────────────
 *
 * O editor traz os FATOS (as notas: o que apurou, colou, leu). A IA traz a
 * REDAÇÃO. Ela nunca traz fato, porque não tem de onde — a instrução do
 * servidor a proíbe, e a tela nem deixa pedir sem notas.
 *
 * Isso não é limitação da versão grátis. É o que tira a alucinação do caminho:
 * um modelo que só redige não inventa data de lançamento, porque não é ele quem
 * traz as datas.
 *
 * ── Três coisas que esta tela NÃO faz, todas de propósito ─────────────────
 *
 * 1. **Não escreve no banco.** O que volta fica aqui, na tela, até alguém
 *    clicar em "Usar este texto". Quem aplica é quem assina.
 * 2. **Não substitui campo sem dizer.** Ela mostra o que veio ANTES de aplicar,
 *    e avisa quando vai por cima de algo que já estava escrito.
 * 3. **Não esconde as lacunas.** O modelo é instruído a escrever
 *    `[CONFERIR: o que falta]` no lugar do que as notas não têm — e a tela
 *    CONTA esses marcadores em cima, onde o revisor vê antes de ler.
 */
export default function RascunharComIa({ campos, onAplicar }) {
  const [aberto, setAberto] = useState(false);
  const [notas, setNotas] = useState('');
  const [pedindo, setPedindo] = useState(false);
  const [erro, setErro] = useState('');
  const [rascunho, setRascunho] = useState(null);

  const notasProntas = notas.trim().length >= MINIMO_DE_NOTAS;

  async function redigir() {
    if (!notasProntas || pedindo) return;
    setPedindo(true);
    setErro('');
    setRascunho(null);
    const { data, error } = await rascunharComIa({
      titulo: campos.titulo, notas, fonteUrl: campos.fonte_url,
    });
    setPedindo(false);
    // O erro do servidor chega inteiro. Ele já vem em português e diz o que
    // fazer — "cota acabou, escreva à mão" é acionável; "erro" não é (§1.5).
    if (error) { setErro(error.message ?? 'A IA não respondeu.'); return; }
    setRascunho(data);
  }

  function usar() {
    onAplicar({
      titulo:    rascunho.titulo    || campos.titulo,
      subtitulo: rascunho.subtitulo || campos.subtitulo,
      resumo:    rascunho.resumo    || campos.resumo,
      conteudo:  rascunho.corpo     || campos.conteudo,
      redigido_com_ia: true,
    });
    setRascunho(null);
    setAberto(false);
  }

  const lacunas = rascunho ? lacunasDoRascunho(rascunho) : 0;
  const vaiPorCima = rascunho && campos.conteudo?.trim();

  return (
    <div className="card p-4 space-y-3">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="w-full flex items-center gap-2 text-left"
      >
        <Sparkles size={14} className="text-neon-purple shrink-0" />
        <h3 className="font-display text-xs text-white uppercase tracking-wider flex-1">
          Rascunhar com IA
        </h3>
        {aberto ? <ChevronUp size={14} className="text-gray-500" />
                : <ChevronDown size={14} className="text-gray-500" />}
      </button>

      {aberto && (
        <>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Cole aqui o que você apurou — trechos, anúncios, números, declarações.
            A IA <strong className="text-gray-300">só redige o que estiver nas notas</strong>;
            ela não sabe nada sobre o assunto e vai marcar
            <span className="font-mono text-yellow-400"> [CONFERIR: …]</span> no
            lugar do que faltar. O texto volta para você revisar — nada é salvo
            nem publicado sozinho.
          </p>

          <textarea
            value={notas} onChange={(e) => setNotas(e.target.value)}
            rows={6} maxLength={6000}
            placeholder="As notas da matéria — o que você apurou, colou ou leu"
            aria-label="Notas da matéria"
            className="input-gamer resize-none text-sm"
          />

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={redigir} disabled={!notasProntas || pedindo}
              className="btn-neon flex items-center gap-2"
            >
              <Sparkles size={14} /> {pedindo ? 'Redigindo…' : 'Redigir rascunho'}
            </button>
            <span className="text-[11px] font-mono text-gray-600">
              {notasProntas
                ? `${notas.trim().length} caracteres de notas`
                : `faltam ${MINIMO_DE_NOTAS - notas.trim().length} caracteres para a IA ter de onde escrever`}
            </span>
          </div>

          {erro && <p className="text-xs text-red-400 font-mono">{erro}</p>}

          {rascunho && (
            <div className="space-y-3 border-t border-dark-500 pt-3">
              {lacunas > 0 && (
                <p className="flex items-start gap-2 text-xs text-yellow-400">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>
                    {lacunas === 1
                      ? 'A IA marcou 1 lacuna com [CONFERIR: …] — falta um dado nas notas.'
                      : `A IA marcou ${lacunas} lacunas com [CONFERIR: …] — faltam dados nas notas.`}
                  </span>
                </p>
              )}

              <div className="space-y-2">
                <Campo rotulo="Título" texto={rascunho.titulo} />
                <Campo rotulo="Subtítulo" texto={rascunho.subtitulo} />
                <Campo rotulo="Resumo" texto={rascunho.resumo} />
                <Campo rotulo="Corpo" texto={rascunho.corpo} longo />
              </div>

              {vaiPorCima && (
                <p className="text-[11px] text-yellow-400 font-mono">
                  Isto vai substituir o corpo que já está escrito.
                </p>
              )}

              <div className="flex gap-2 flex-wrap">
                <button onClick={usar} className="btn-neon flex items-center gap-2">
                  <Check size={14} /> Usar este texto
                </button>
                <button onClick={() => setRascunho(null)} className="btn-ghost flex items-center gap-2">
                  <X size={14} /> Descartar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Um pedaço do rascunho, como texto puro. Nada aqui é editável: quem edita é
 *  o formulário, depois de aplicar. */
function Campo({ rotulo, texto, longo = false }) {
  if (!texto?.trim()) return null;
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-600">{rotulo}</p>
      <p className={`text-sm text-gray-200 whitespace-pre-wrap ${longo ? 'max-h-60 overflow-y-auto' : ''}`}>
        {texto}
      </p>
    </div>
  );
}
