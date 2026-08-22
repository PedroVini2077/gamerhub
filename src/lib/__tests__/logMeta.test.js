import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACTION_META, NOTIF_META, LOG_CATEGORIES, CATEGORY_META, ACTIONS_DO_BANCO,
  actionMeta, notifMeta, feedItemMeta, LOG_RETENTION_DAYS,
} from '../logMeta';

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

  // Action gravada por trigger/função do Postgres não existe como string em
  // `src/`, então a varredura do código-fonte nunca a veria.
  it('actions geradas pelo banco têm ícone registrado', () => {
    expect(ACTIONS_DO_BANCO.length).toBeGreaterThan(3);
    expect(ACTIONS_DO_BANCO.filter(a => !ACTION_META[a])).toEqual([]);
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
