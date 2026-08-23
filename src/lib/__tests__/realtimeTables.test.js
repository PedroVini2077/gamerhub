import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TABELAS_REALTIME, FORA_DO_REALTIME_DE_PROPOSITO } from '../realtimeTables';

const RAIZ = join(import.meta.dirname, '../..');

function arquivosDeCodigo(dir) {
  return readdirSync(dir).flatMap(nome => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      return nome === '__tests__' ? [] : arquivosDeCodigo(caminho);
    }
    return /\.jsx?$/.test(nome) ? [caminho] : [];
  });
}

/** Toda tabela que o código assina, com o arquivo onde a assinatura está. */
function assinaturasNoCodigo() {
  const achados = new Map();
  for (const caminho of arquivosDeCodigo(RAIZ)) {
    const src = readFileSync(caminho, 'utf8');
    const relativo = caminho.slice(RAIZ.length + 1);
    // `.on('postgres_changes', { ..., table: 'x' }, ...)`
    for (const m of src.matchAll(/table:\s*'([a-z_]+)'/g)) {
      achados.set(m[1], relativo);
    }
    // o atalho `useRealtime('x', ...)` — mas não a declaração do próprio hook
    for (const m of src.matchAll(/useRealtime\(\s*'([a-z_]+)'/g)) {
      achados.set(m[1], relativo);
    }
  }
  return achados;
}

// Assinar tabela fora da publicação `supabase_realtime` NÃO dá erro: o canal
// conecta, o subscribe responde SUBSCRIBED e nenhum evento chega nunca. Só se
// descobre olhando a tela e percebendo que ela não atualiza sozinha — foi o que
// aconteceu com `unban_requests` e `live_reactivation_requests` no painel admin.
describe('assinaturas de realtime', () => {
  const assinadas = assinaturasNoCodigo();

  it('encontra as assinaturas do código (guarda contra o regex quebrar)', () => {
    expect(assinadas.size).toBeGreaterThanOrEqual(8);
    expect(assinadas.has('live_chat')).toBe(true);
  });

  it('toda tabela assinada está declarada como publicada', () => {
    const mortas = [...assinadas]
      .filter(([tabela]) => !TABELAS_REALTIME.includes(tabela))
      .map(([tabela, arquivo]) => `${tabela} (${arquivo})`);

    expect(mortas, mortas.length
      ? `Assinatura que nunca vai receber evento. Rode "ALTER PUBLICATION `
        + `supabase_realtime ADD TABLE public.<tabela>;" e acrescente o nome em `
        + `lib/realtimeTables.js:\n  ${mortas.join('\n  ')}`
      : undefined).toEqual([]);
  });

  it('nenhuma tabela está nas duas listas ao mesmo tempo', () => {
    const conflito = TABELAS_REALTIME.filter(t => FORA_DO_REALTIME_DE_PROPOSITO.includes(t));
    expect(conflito).toEqual([]);
  });

  it('não assina tabela que foi deixada fora de propósito', () => {
    const indevidas = [...assinadas]
      .filter(([tabela]) => FORA_DO_REALTIME_DE_PROPOSITO.includes(tabela))
      .map(([tabela, arquivo]) => `${tabela} (${arquivo})`);
    expect(indevidas).toEqual([]);
  });
});
