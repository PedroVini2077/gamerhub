import { Award, Lock } from 'lucide-react';

import { avaliarConquistas, contarConcluidas } from '../../lib/conquistas';

/**
 * As conquistas do perfil.
 *
 * Os dados vêm da mesma chamada que o card de stats já faz — nenhuma consulta
 * nova. A justificativa de por que elas são derivadas, e o que se perde com
 * isso, está em `lib/conquistas.js`.
 *
 * ── Enquanto o dado não chega, ele DIZ que não chegou ───────────────────────
 *
 * Não mostra oito conquistas zeradas. Zerar seria afirmar que a pessoa não tem
 * nenhuma — e quem já tem sete veria sete cadeados por um instante a cada
 * carregamento. "Carregando" é a informação verdadeira ali.
 */
export default function ConquistasCard({ xpData, profile }) {
  const conquistas = avaliarConquistas(xpData, profile);
  const resumo = contarConcluidas(conquistas);

  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase flex items-center justify-between gap-2">
        <span className="flex items-center gap-2"><Award size={12} />Conquistas</span>
        {resumo && (
          <span className="font-mono text-[11px] text-gray-600 normal-case tracking-normal">
            {resumo.feitas} de {resumo.total}
          </span>
        )}
      </h3>

      {/* Uma coluna, e não duas: o card do perfil tem `max-w-lg` (512 px), e
          duas colunas ali dariam ~240 px por item — a descrição quebraria em
          três linhas. Conferido no print de 05/09. */}
      {!conquistas ? (
        <p className="text-xs font-mono text-gray-600 py-2">Carregando conquistas…</p>
      ) : (
        <ul className="grid gap-2">
          {conquistas.map((c) => <ItemDeConquista key={c.id} conquista={c} />)}
        </ul>
      )}
    </div>
  );
}

/**
 * Um item.
 *
 * Conquista bloqueada continua **legível**: o nome e a descrição aparecem, e é
 * a cor e o cadeado que dizem o estado. Esconder o nome do que falta transforma
 * a lista num enigma em vez de num objetivo.
 */
function ItemDeConquista({ conquista }) {
  const { Icon, nome, descricao, cor, valor, meta, concluida, progresso } = conquista;

  return (
    <li
      className={`rounded border p-3 flex gap-3 items-start transition-colors ${
        concluida ? 'bg-dark-700 border-dark-400' : 'bg-dark-800/60 border-dark-500'
      }`}
    >
      <span
        className="shrink-0 mt-0.5"
        style={{
          color: concluida ? cor : '#4b5563',
          filter: concluida ? `drop-shadow(0 0 6px ${cor}66)` : 'none',
        }}
      >
        {concluida ? <Icon size={16} /> : <Lock size={14} />}
      </span>

      <div className="min-w-0 flex-1">
        <p className={`font-display text-[11px] tracking-wider uppercase ${
          concluida ? 'text-gray-200' : 'text-gray-500'
        }`}>
          {nome}
        </p>
        <p className="text-[11px] font-mono text-gray-600 leading-snug mt-0.5">{descricao}</p>

        {/* A barra some quando a conquista já foi feita: barra cheia parada é
            ruído, e o ícone aceso já diz o que precisa ser dito. */}
        {!concluida && (
          <div className="mt-2">
            <div className="h-1 rounded bg-dark-500 overflow-hidden">
              <div
                className="h-full rounded transition-[width] duration-500"
                style={{ width: `${progresso}%`, background: cor, opacity: 0.75 }}
              />
            </div>
            <p className="text-[10px] font-mono text-gray-600 mt-1">{valor} / {meta}</p>
          </div>
        )}
      </div>
    </li>
  );
}
