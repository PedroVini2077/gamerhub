import { describe, it, expect } from 'vitest';
import { etapasDoCaso, DESFECHOS, STATUS_DO_BANCO } from '../etapasDoCaso';

const BANIDO_EM = '2026-09-01T10:00:00Z';

describe('etapasDoCaso', () => {
  it('sem recurso, mostra o que FALTA em vez de um vazio', () => {
    const e = etapasDoCaso({ banidoEm: BANIDO_EM, pedido: null });
    expect(e.map(x => x.id)).toEqual(['banido', 'sem-recurso']);
    expect(e[1].estado, 'o próximo passo é da pessoa, então é futura').toBe('futura');
  });

  it('recurso pendente termina em "Em análise", e essa é a etapa atual', () => {
    const e = etapasDoCaso({
      banidoEm: BANIDO_EM,
      pedido: { status: 'pending', enviado_em: '2026-09-01T12:00:00Z' },
    });
    expect(e.map(x => x.id)).toEqual(['banido', 'recurso-enviado', 'desfecho']);
    expect(e[2].rotulo).toBe('Em análise pela equipe');
    expect(e[2].estado).toBe('atual');
  });

  it('recurso negado carrega a resposta da equipe', () => {
    const e = etapasDoCaso({
      banidoEm: BANIDO_EM,
      pedido: {
        status: 'denied', enviado_em: '2026-09-01T12:00:00Z',
        respondido_em: '2026-09-02T09:00:00Z', resposta: 'Reincidência.',
      },
    });
    expect(e[2].rotulo).toBe('Recurso negado');
    expect(e[2].tom).toBe('ruim');
    expect(e[2].detalhe).toBe('Reincidência.');
    expect(e[2].quando?.toISOString()).toBe('2026-09-02T09:00:00.000Z');
  });

  it('status DESCONHECIDO aparece na tela, e não vira "Em análise"', () => {
    // Esta é a razão de o mapa ser fechado. Se um `status` novo nascesse no
    // banco e caísse num `else`, a pessoa ficaria esperando para sempre uma
    // decisão que já saiu — falha silenciosa da qual ninguém reclama, porque
    // ela não parece um erro (§4).
    const e = etapasDoCaso({
      banidoEm: BANIDO_EM,
      pedido: { status: 'expirou', enviado_em: '2026-09-01T12:00:00Z' },
    });
    expect(e[2].id).toBe('desfecho-desconhecido');
    expect(e[2].rotulo).toContain('expirou');
  });

  it('data ausente ou inválida vira null, não "Invalid Date" na tela', () => {
    const e = etapasDoCaso({ banidoEm: 'nao-e-data', pedido: null });
    expect(e[0].quando).toBeNull();
  });
});

describe('os desfechos batem com o que o banco realmente grava', () => {
  it('todo status que unban_requests aceita tem entrada em DESFECHOS', () => {
    // ── O bug de 02/09, e por que esta trava existe ───────────────────────
    // A `BannedScreen` testava `status === 'rejected'`. O banco grava
    // `'denied'` — conferido no `prosrc` da `deny_unban_request`. Quem teve o
    // recurso NEGADO via "Em análise" para sempre: esperava uma decisão que já
    // tinha saído, e nada indicava erro (§1.5).
    const faltando = STATUS_DO_BANCO.filter(s => !DESFECHOS[s]);
    expect(faltando,
      `Status que o banco aceita e a linha do tempo nao conhece: ${faltando.join(', ')}.\n`
      + '  Ele cairia em "Estado nao reconhecido" na tela de quem foi banido.\n'
      + '  Acrescente em DESFECHOS, em src/lib/etapasDoCaso.js.')
      .toEqual([]);

    const sobrando = Object.keys(DESFECHOS).filter(s => !STATUS_DO_BANCO.includes(s));
    expect(sobrando,
      `Desfecho mapeado que o banco NUNCA grava: ${sobrando.join(', ')}.\n`
      + '  Foi exatamente esta forma do bug: um ramo do codigo que nunca roda,\n'
      + '  e o caso real caindo no fallback. Confira o CHECK de\n'
      + '  unban_requests.status e o que approve_/deny_unban_request gravam.')
      .toEqual([]);
  });
});
