import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROTAS_VISITANTE, ROTAS_LOGADO, ROTAS_SEM_COBERTURA_E2E,
} from '../../../e2e/rotas.mjs';

/**
 * Trava contra "cobertura que não cobre" (CLAUDE.md §1.5, fonte de silêncio 6).
 *
 * O bug que este teste existe para impedir já aconteceu: o `smoke.mjs` listava
 * `/home`, `/comunidade`, `/perfil` e `/configuracoes`. Nenhuma dessas rotas
 * existe — as de verdade são `/`, `/community`, `/profile` e `/settings`. As
 * quatro caíam na tela de 404, e como o conteúdo esperado delas era `/./`
 * ("qualquer coisa"), o teste imprimia "12/12 rotas OK" sem nunca ter aberto
 * quatro das telas. Nada estourava; a cobertura era ficção.
 *
 * Nenhum teste de runtime pega isso, porque do ponto de vista do navegador
 * está tudo certo: a rota `*` renderizou. Só o confronto entre as duas listas
 * revela a deriva — é a Fase 4 da auditoria aplicada ao próprio ferramental.
 */

const APP = join(import.meta.dirname, '../../App.jsx');
const fonte = readFileSync(APP, 'utf8');

/** Todo `path="..."` declarado no App.jsx. */
const rotasDoApp = [...fonte.matchAll(/<Route\s+path="([^"]+)"/g)].map(m => m[1]);

/** `/u/:username` vira `^/u/[^/]+$`; `*` casa com qualquer coisa. */
function paraRegex(padrao) {
  if (padrao === '*') return /^.*$/;
  const corpo = padrao
    .split('/')
    .map(seg => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${corpo}$`);
}

const CATCH_ALL = '*';
const declaradas = rotasDoApp.filter(p => p !== CATCH_ALL);

/** Qual rota do App atende este caminho (ignorando o catch-all). */
function rotaQueAtende(caminho) {
  return declaradas.find(padrao => paraRegex(padrao).test(caminho));
}

const listadas = [
  ...ROTAS_VISITANTE.map(r => ({ ...r, lista: 'ROTAS_VISITANTE' })),
  ...ROTAS_LOGADO.map(r => ({ ...r, lista: 'ROTAS_LOGADO' })),
];

describe('rotas exercitadas pelos testes de navegador', () => {
  it('acha as rotas do App.jsx (guarda contra o regex quebrar)', () => {
    expect(rotasDoApp.length).toBeGreaterThanOrEqual(12);
    expect(rotasDoApp).toContain('/');
    expect(rotasDoApp).toContain(CATCH_ALL);
  });

  it('todo caminho testado corresponde a uma rota que existe', () => {
    // Exceção: as entradas cujo nome é "404" existem justamente para exercitar
    // o catch-all — para elas, NÃO casar é o comportamento correto.
    const fantasmas = listadas
      .filter(r => r.nome !== '404' && !rotaQueAtende(r.path))
      .map(r => `${r.path}  (${r.lista}, "${r.nome}")`);

    expect(fantasmas, fantasmas.length
      ? 'Estes caminhos não existem no App.jsx: caem na tela de 404 e o teste '
        + 'passa sem nunca abrir a tela que diz estar testando. Corrija o '
        + `caminho em e2e/rotas.mjs:\n  ${fantasmas.join('\n  ')}`
      : undefined).toEqual([]);
  });

  it('a entrada de 404 realmente não corresponde a nenhuma rota', () => {
    // Se alguém criar uma rota `/rota-que-nao-existe`, o teste de 404 passaria
    // a testar outra coisa em silêncio.
    const falsos404 = listadas
      .filter(r => r.nome === '404' && rotaQueAtende(r.path))
      .map(r => `${r.path} agora casa com ${rotaQueAtende(r.path)}`);
    expect(falsos404).toEqual([]);
  });

  it('toda rota do App é aberta por algum teste, ou tem exceção declarada', () => {
    const descobertas = declaradas.filter(padrao => {
      if (padrao in ROTAS_SEM_COBERTURA_E2E) return false;
      return !listadas.some(r => paraRegex(padrao).test(r.path));
    });

    expect(descobertas, descobertas.length
      ? 'Rotas que nenhum teste de navegador abre. Acrescente em '
        + 'e2e/rotas.mjs (ROTAS_VISITANTE e/ou ROTAS_LOGADO) — ou, se não der '
        + 'para testar, declare em ROTAS_SEM_COBERTURA_E2E com o motivo '
        + `escrito:\n  ${descobertas.join('\n  ')}`
      : undefined).toEqual([]);
  });

  it('exceção de cobertura só vale para rota que existe, e com motivo escrito', () => {
    for (const [caminho, motivo] of Object.entries(ROTAS_SEM_COBERTURA_E2E)) {
      expect(declaradas, `${caminho} está em ROTAS_SEM_COBERTURA_E2E mas não é `
        + 'uma rota do App.jsx — provavelmente a rota foi removida e a exceção '
        + 'ficou para trás.').toContain(caminho);
      expect(motivo.length, `A exceção de ${caminho} precisa de um motivo `
        + 'de verdade, não uma frase solta.').toBeGreaterThan(40);
    }
  });
});
