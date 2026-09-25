import { Sparkles } from 'lucide-react';

/**
 * `[25/09]` A marca de "rascunhada com IA".
 *
 * Componente próprio porque aparece em TRÊS telas — a lista do painel
 * editorial, a fila do Fundador e o cabeçalho do editor. Três cópias do mesmo
 * `<span>` é como os ícones de log divergiram (§4, fonte única).
 *
 * Ela existe para uma coisa só: o revisor saber ANTES de ler. Texto de modelo
 * é plausível por construção, e plausível é o que engana leitura corrida — a
 * marca é o que transforma "ler" em "conferir".
 */
export default function MarcaDeIa({ ativo }) {
  if (!ativo) return null;
  return (
    <span
      title="O rascunho desta matéria foi escrito por IA a partir das notas do editor"
      className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-neon-purple shrink-0"
    >
      <Sparkles size={11} /> IA
    </span>
  );
}
