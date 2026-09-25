import { Lightbulb, AlertCircle } from 'lucide-react';
import { sugestoesPara, rotuloSugerido } from '../../lib/news/assistente';

/**
 * `[25/09]` O que o painel SUGERE para uma matéria — e nada aqui se aplica só.
 *
 * ── Por que é um componente separado ──────────────────────────────────────
 *
 * O `EditorDeArtigo` já estava em 196 linhas. Enfiar isto lá o levaria para
 * perto do teto de 300 (§4), e a responsabilidade é outra: ele é o formulário,
 * este é o conselho. Separados, dá para mudar o conselho sem reler o formulário.
 *
 * ── A regra de interação, e ela é a parte que importa ─────────────────────
 *
 * **Toda sugestão é um BOTÃO.** Nada é preenchido sozinho, nem quando o campo
 * está vazio. Campo que se preenche sozinho é campo que ninguém relê — e quem
 * assina a matéria é quem clicou, não o painel.
 *
 * Os avisos não têm botão: eles são perguntas de conferência, e algumas têm
 * resposta legítima "eu sei, é assim mesmo" (apuração própria não tem link de
 * fonte). Transformá-los em bloqueio faria a ferramenta discutir com o editor.
 */
export default function SugestoesDaMateria({ campos, onAplicar }) {
  const { editoria, resumo, avisos } = sugestoesPara(campos);

  // A sugestão de editoria só vale se for DIFERENTE do que já está escolhido.
  const editoriaUtil = editoria && editoria !== campos.editoria ? editoria : null;
  const temAlgo = editoriaUtil || resumo || avisos.length > 0;
  if (!temAlgo) return null;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb size={14} className="text-neon-cyan shrink-0" />
        <h3 className="font-display text-xs text-white uppercase tracking-wider">Sugestões</h3>
      </div>

      {(editoriaUtil || resumo) && (
        <div className="flex gap-2 flex-wrap">
          {editoriaUtil && (
            <button
              onClick={() => onAplicar('editoria', editoriaUtil)}
              className="tag tag-cyan cursor-pointer"
            >
              Editoria: {rotuloSugerido(editoriaUtil)}
            </button>
          )}
          {resumo && (
            <button
              onClick={() => onAplicar('resumo', resumo)}
              className="tag tag-cyan cursor-pointer"
              title={resumo}
            >
              Usar as primeiras frases como resumo
            </button>
          )}
        </div>
      )}

      {avisos.length > 0 && (
        <ul className="space-y-1.5">
          {avisos.map((aviso) => (
            <li key={aviso} className="flex gap-2 text-xs text-gray-500 leading-relaxed">
              <AlertCircle size={12} className="text-yellow-400/70 shrink-0 mt-0.5" />
              <span>{aviso}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Dito na tela, não só no código: o que aparece aqui sai do que já foi
          escrito. Sem isto, alguém pode achar que um modelo redigiu por ele. */}
      <p className="text-[10px] text-gray-700 font-mono">
        Tudo aqui sai do texto que você já escreveu — nada foi gerado.
      </p>
    </div>
  );
}
