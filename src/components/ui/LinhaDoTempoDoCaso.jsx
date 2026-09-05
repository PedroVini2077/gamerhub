import { Check, Circle, Clock } from 'lucide-react';
import { etapasDoCaso } from '../../lib/etapasDoCaso';

/**
 * A linha do tempo do caso, na tela de quem foi banido.
 *
 * ── Por que ela existe ──────────────────────────────────────────────────────
 *
 * A tela já dizia o estado — "Em análise", "Negado" —, e um estado é um
 * retrato: não conta o que já aconteceu nem o que ainda pode acontecer. Do
 * lado de quem levou o ban, a diferença entre *"meu recurso sumiu"* e *"meu
 * recurso está na fila"* é a diferença entre achar que o site engoliu o pedido
 * e saber esperar.
 *
 * ── Por que é um arquivo separado ───────────────────────────────────────────
 *
 * A `BannedScreen` já estava em 256 linhas. Somar isto ali a levaria acima de
 * 300, e o §4 manda dividir ANTES de entregar — não anotar para depois.
 *
 * A decisão de quais etapas existem mora em `lib/etapasDoCaso.js`, testada
 * isolada. Aqui só tem desenho.
 */

const TOM = {
  bom:    'text-neon-green border-neon-green/40',
  ruim:   'text-red-400 border-red-400/40',
  neutro: 'text-yellow-400 border-yellow-400/40',
};

const ICONE = {
  concluida: Check,
  atual: Clock,
  futura: Circle,
};

export default function LinhaDoTempoDoCaso({ banidoEm, pedido }) {
  const etapas = etapasDoCaso({ banidoEm, pedido });

  return (
    <ol className="space-y-0">
      {etapas.map((etapa, i) => {
        const Icone = ICONE[etapa.estado];
        const ultima = i === etapas.length - 1;
        return (
          <li key={etapa.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`grid place-items-center w-6 h-6 rounded-full border shrink-0
                            ${TOM[etapa.tom] ?? TOM.neutro}
                            ${etapa.estado === 'futura' ? 'opacity-40' : ''}`}
              >
                <Icone size={12} />
              </span>
              {/* O fio some na última etapa: linha que continua depois do fim
                  sugere um passo que não existe. */}
              {!ultima && <span className="w-px flex-1 min-h-4 bg-dark-500" />}
            </div>

            <div className={`pb-4 min-w-0 ${ultima ? 'pb-0' : ''}`}>
              <p className={`text-xs font-mono font-bold
                             ${etapa.estado === 'futura' ? 'text-gray-500' : 'text-gray-200'}`}>
                {etapa.rotulo}
              </p>
              {etapa.quando && (
                <p className="text-[11px] font-mono text-gray-600 tabular-nums">
                  {etapa.quando.toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
              {etapa.detalhe && (
                <p className="text-xs font-mono text-gray-400 leading-relaxed mt-1">
                  {etapa.detalhe}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
