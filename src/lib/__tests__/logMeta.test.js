import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACTION_META, NOTIF_META, LOG_CATEGORIES, CATEGORY_META,
  actionMeta, notifMeta, feedItemMeta, LOG_RETENTION_DAYS, textoDoLog,
} from '../logMeta';
import { actionsDoBanco, tiposDeNotificacaoDoBanco } from './actionsDoBanco';

// Estes testes existem porque o bug real foi DERIVA: o site passou a gravar
// actions e categorias novas, e os painéis continuaram com mapas antigos —
// metade dos eventos caía no ícone genérico e duas categorias inteiras
// (`live`, `profile`) sequer apareciam no filtro. Aqui a cobertura é verificada
// contra o código-fonte, então esquecer de registrar uma action quebra o teste.

const ROOT = new URL('../../', import.meta.url).pathname;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    // Os próprios testes contêm exemplos como `logAudit('x')` — varrê-los
    // geraria falso positivo.
    if (entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(jsx?|sql)$/.test(entry)) out.push(full);
  }
  return out;
}

const sources = walk(ROOT).map(f => readFileSync(f, 'utf8')).join('\n');

function matchAll(re) {
  return [...new Set([...sources.matchAll(re)].map(m => m[1]))];
}

describe('cobertura de actions de auditoria', () => {
  it('toda action passada a logAudit() tem ícone registrado', () => {
    const used = matchAll(/logAudit\(\s*\n?\s*'([a-z_]+)'/g);
    expect(used.length).toBeGreaterThan(15); // sanity: o grep achou mesmo algo
    expect(used.filter(a => !ACTION_META[a])).toEqual([]);
  });

  // Esta rede tinha um furo: ela só enxergava `logAudit('x')` literal. Quando os
  // hooks do Admin foram extraídos, as chamadas viraram helpers locais
  // — `log('x', ...)` e `done(msg, 'x', ...)` — e OITO actions em uso sumiram
  // da cobertura sem ninguém notar. O teste passava e o ícone era o genérico.
  it('actions passadas pelos helpers locais também têm ícone', () => {
    const used = [
      ...matchAll(/\blog\(\s*\n?\s*'([a-z_]+)'/g),
      ...matchAll(/\bdone\([^,]+,\s*\n?\s*'([a-z_]+)'/g),
    ];
    expect(used.length).toBeGreaterThan(5);
    expect(used.filter(a => !ACTION_META[a])).toEqual([]);
  });

  // Action gravada por função do Postgres não existe como string em `src/`,
  // então a varredura do código-fonte nunca a veria.
  //
  // `[05/09]` ISTO ERA UMA LISTA ESCRITA À MÃO, e a Fase 4 da auditoria achou
  // ONZE actions vivas fora dela — todas chegando ao painel com o ícone
  // genérico, sem nada estourar. O problema não era a lista estar errada: era
  // ela precisar ser LEMBRADA, que é a mesma classe de falha que ela deveria
  // resolver. Agora a lista é derivada das migrations. Ver `actionsDoBanco.js`.
  it('actions geradas pelo banco têm ícone registrado', () => {
    const doBanco = actionsDoBanco();

    expect(doBanco.length, 'a varredura das migrations nao achou action nenhuma')
      .toBeGreaterThan(10);

    expect(
      doBanco.filter(a => !ACTION_META[a]),
      'action gravada por funcao do Postgres SEM icone em ACTION_META.\n'
      + 'Ela aparece no painel de trilha com o icone generico, e nada estoura.\n'
      + 'Acrescente uma linha em ACTION_META (src/lib/logMeta.js) com o icone e\n'
      + 'a cor — a lista acima foi lida das proprias migrations.',
    ).toEqual([]);
  });

  // `[05/09]` O irmão do teste acima, e ele nasceu junto porque o defeito era o
  // mesmo dos dois lados: a Fase 4 achou `security_alert` (de
  // `contabilizar_falha_de_login`) e `user_unsuspended` (de `lift_suspension`)
  // chegando ao sino da equipe com o ícone genérico. Fechar um e deixar o outro
  // aberto seria repetir exatamente o erro que a fase existe para não repetir.
  it('tipos de notificação gerados pelo banco têm ícone registrado', () => {
    const doBanco = tiposDeNotificacaoDoBanco();

    expect(doBanco.length, 'a varredura das migrations nao achou tipo nenhum')
      .toBeGreaterThan(5);

    expect(
      doBanco.filter(t => !NOTIF_META[t]),
      'tipo de admin_notifications SEM icone em NOTIF_META.\n'
      + 'Ele aparece no sino da equipe com o icone generico, e nada estoura.\n'
      + 'Acrescente uma linha em NOTIF_META (src/lib/logMeta.js) — a lista acima\n'
      + 'foi lida das proprias migrations.',
    ).toEqual([]);
  });

  it('toda categoria usada em logAudit() aparece no filtro dos painéis', () => {
    // Só as categorias que aparecem DENTRO de uma chamada de logAudit — o
    // projeto usa `category` também para categoria de post ('dica' etc.).
    const used = [...new Set(
      [...sources.matchAll(/logAudit\(([\s\S]{0,500}?)\);/g)]
        .flatMap(m => [...m[1].matchAll(/category:\s*'([a-z_]+)'/g)].map(c => c[1])),
    )];
    expect(used.length).toBeGreaterThan(3);
    expect(used.filter(c => !CATEGORY_META[c])).toEqual([]);
  });
});

describe('fallbacks', () => {
  it('action desconhecida devolve o ícone genérico em vez de quebrar', () => {
    const meta = actionMeta('coisa_que_nao_existe');
    expect(meta.Icon).toBeTruthy();
    expect(meta.cls).toBeTruthy();
    expect(actionMeta(undefined).Icon).toBeTruthy();
  });

  it('tipo de notificação desconhecido também tem fallback', () => {
    expect(notifMeta('tipo_novo_qualquer').Icon).toBeTruthy();
    expect(notifMeta(null).Icon).toBeTruthy();
  });

  it('feedItemMeta resolve tanto por `kind` quanto por `action`', () => {
    expect(feedItemMeta({ kind: 'staff_alert' })).toBe(NOTIF_META.staff_alert);
    expect(feedItemMeta({ action: 'admin_ban' })).toBe(ACTION_META.admin_ban);
    // item vazio não pode explodir — o painel do dono mistura as duas fontes
    expect(feedItemMeta({}).Icon).toBeTruthy();
    expect(feedItemMeta(null).Icon).toBeTruthy();
  });
});

describe('consistência dos mapas', () => {
  it('toda categoria da lista tem rótulo, ícone e cor', () => {
    for (const c of LOG_CATEGORIES) {
      expect(c.id).toMatch(/^[a-z_]+$/);
      expect(c.label).toBeTruthy();
      expect(c.Icon).toBeTruthy();
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('toda entrada de ícone tem Icon, classe e cor', () => {
    for (const [key, meta] of Object.entries({ ...ACTION_META, ...NOTIF_META })) {
      expect(meta.Icon, key).toBeTruthy();
      expect(meta.cls, key).toMatch(/^text-/);
      expect(meta.color, key).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('a retenção mostrada na UI bate com a do script SQL', () => {
    const sql = readFileSync(join(ROOT, '../db/2026-08-otimizacao.sql'), 'utf8');
    expect(sql).toContain(`interval '${LOG_RETENTION_DAYS} days'`);
  });
});

// ─── `[18/09]` A linha de log que aparecia EM BRANCO ──────────────────────────
//
// O dono mandou print do painel com entradas sem título nenhum: só data e
// categoria. A causa (`record_banned_login_attempt` aceitando `p_email` nulo e
// gravando `details = NULL`) está fechada na SEC-030 — mas causa fechada não
// conserta as linhas que já existem, nem a próxima função que esquecer o
// `details`.
//
// **Log que ninguém consegue ler é log que não existe** (§1.5): a fonte de
// silêncio nº 7 é exatamente "o erro foi registrado onde ninguém vê".
describe('log sem detalhe ainda diz alguma coisa', () => {
  it('cai para a action quando `details` é nulo', () => {
    const texto = textoDoLog({ action: 'auth_banned_attempt', details: null });
    expect(texto, 'Log sem detalhe voltou a virar string vazia no painel.')
      .toContain('auth_banned_attempt');
    expect(texto, 'O card precisa DIZER que o detalhe faltou, senão a linha '
      + 'parece normal e ninguém investiga.').toMatch(/sem detalhe/i);
  });

  it('string vazia e só-espaços contam como ausente', () => {
    // `details: ''` e `details: '   '` renderizam igual a `null`: um card mudo.
    for (const vazio of ['', '   ']) {
      expect(textoDoLog({ action: 'post_edited', details: vazio }))
        .toMatch(/sem detalhe/i);
    }
  });

  it('não mexe no log normal', () => {
    // A trava não pode "consertar" o caminho feliz — se ela reescrevesse o
    // texto de todo log, o painel passaria a mentir em 100% das linhas para
    // resolver as 2 que estavam quebradas.
    expect(textoDoLog({ action: 'auth_logout', details: '@fulano fez logout' }))
      .toBe('@fulano fez logout');
  });
});
