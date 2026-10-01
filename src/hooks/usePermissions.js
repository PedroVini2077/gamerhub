import { useMemo } from 'react';
import { useRole } from './useRole';
import { podeComOPapel, CAPACIDADES_CONHECIDAS } from '../lib/capacidades';

/**
 * `[01/10]` `can()` para a UI.
 *
 * ── O que ele NÃO faz ─────────────────────────────────────────────────────
 *
 * Não chama o servidor. A capacidade é derivada do papel que o `useAuth` já
 * carregou — pedir ao banco a cada render seria uma viagem de rede por botão,
 * e o banco já vai decidir de verdade quando a ação acontecer.
 *
 * E não substitui `canModerate(viewer, alvo)` nem `canModerateLive(...)`:
 * essas dependem de um SEGUNDO ator ou de um objeto, e capacidade booleana de
 * uma pessoa só não expressa isso. Ver `lib/capacidades.js`.
 *
 * ── Uso ───────────────────────────────────────────────────────────────────
 *
 *     const { can } = usePermissions();
 *     {can('ban_users') && <BotaoBanir />}
 */
export function usePermissions() {
  const { role, isBanned } = useRole();

  return useMemo(() => ({
    /**
     * Conta BANIDA não tem capacidade nenhuma — espelha o `operador_ativo()`
     * que o `is_staff()` do banco embute desde a SEC-053. Sem isto, um admin
     * banido veria a UI de equipe inteira e só descobriria ao clicar.
     */
    can: (capacidade) => !isBanned && podeComOPapel(role, capacidade),
    capacidades: CAPACIDADES_CONHECIDAS,
  }), [role, isBanned]);
}
