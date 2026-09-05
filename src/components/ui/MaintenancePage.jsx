import { Wrench } from 'lucide-react';
import { motivoDaPausa } from '../../lib/pauseReason';

/**
 * A tela de pausa deliberada — e ela mostra o MOTIVO que o dono escreveu.
 *
 * ── O bug que estava aqui, e ele durou ─────────────────────────────────────
 *
 * Relato do dono, em 03/09: *"a msg personalizada não funcionava"*. Ele estava
 * certo, e a causa era simples de ver e fácil de não notar: **o texto estava
 * cravado neste componente**.
 *
 * O `pause_reason` era lido do `site_config` no efeito do `Layout` e guardado
 * no navegador por `guardarMotivoDaPausa` — mas esta tela nunca o consultava.
 * Ou seja: o campo existia no painel do owner, era salvo no banco, era
 * cacheado, e **morria aqui**.
 *
 * A ironia é que este é o cenário em que a mensagem está MAIS disponível: a
 * pausa é deliberada, então o banco está de pé e o motivo acabou de ser lido.
 *
 * ── Por que `motivoDaPausa()` e não uma prop ───────────────────────────────
 *
 * Porque a mesma função serve os dois cenários, e eles são diferentes:
 *
 *   pausa deliberada (banco DE PÉ) ... o motivo veio do banco há segundos
 *   queda inesperada (banco FORA) .... o motivo é a cópia do navegador
 *
 * `motivoDaPausa()` já resolve os dois e **nunca devolve vazio** — cai no
 * genérico. Receber por prop obrigaria o `Layout` a carregar o valor em estado
 * só para repassar, e criaria a segunda fonte de verdade que o §4 proíbe: o
 * `Hero` da landing já lê pela função.
 */
export default function MaintenancePage() {
  return (
    <div className="flex items-center justify-center min-h-64 py-20">
      <div className="card p-10 text-center max-w-sm space-y-3">
        <Wrench size={36} className="text-neon-green mx-auto" />
        <p className="font-display text-lg text-gray-200">Em Manutenção</p>
        <p className="text-xs font-mono text-gray-500 leading-relaxed">
          {motivoDaPausa()}
        </p>
      </div>
    </div>
  );
}
