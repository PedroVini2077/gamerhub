import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROTAS_COM_SOM, deveTocarSom } from '../rotasComSom';
import { acentoDaSecao, PREFIXOS_COM_ACENTO, PREFIXOS_SEM_FUNDO } from '../acentoDaSecao';

/**
 * ── As duas listas que precisam concordar com o `App.jsx` ───────────────────
 *
 * Som e fundo são decididos por caminho de rota. Rota renomeada deixa uma
 * entrada morta que **não avisa**: o som simplesmente para de tocar numa
 * página, ou o fundo some — e ninguém reporta enfeite ausente como bug.
 *
 * É a mesma família da deriva do §6 FASE 4: dois lugares que precisam
 * concordar para sempre.
 */
const app = readFileSync('src/App.jsx', 'utf8');
const rotasDoApp = [...app.matchAll(/path="([^"]+)"/g)].map(m => m[1]);

describe('rotas com som ambiente', () => {
  it('o App.jsx foi lido de verdade', () => {
    // Sem esta guarda, mudar o formato de `path=` faria a varredura voltar
    // vazia e os testes abaixo passarem VERDE para sempre.
    expect(rotasDoApp.length, 'nenhuma rota encontrada em src/App.jsx').toBeGreaterThan(10);
  });

  it('toda rota com som EXISTE no App', () => {
    const mortas = ROTAS_COM_SOM.filter(r => !rotasDoApp.includes(r));
    expect(mortas,
      `Rota na lista de som que nao existe mais no App.jsx: ${mortas.join(', ')}.\n`
      + '  Ela foi renomeada? O som simplesmente para de tocar nessa pagina, e\n'
      + '  ninguem reporta enfeite ausente como bug.')
      .toEqual([]);
  });

  it('as páginas públicas de texto tocam som', () => {
    // O pedido do dono, com essas palavras: "deve funcionar em toda landing
    // page, entao no sobre deve funcionar, regras e tals, ate mesmo no login".
    for (const rota of ['/sobre', '/regras', '/privacidade', '/termos', '/contato', '/login']) {
      expect(deveTocarSom(rota, false), `${rota} devia ter som`).toBe(true);
    }
  });

  it('a raiz toca para o VISITANTE e cala para quem está logado', () => {
    // Mesma URL, duas telas: landing para quem nao entrou, feed para quem
    // entrou. "chegando no site em si nao e mais pra reproduzir".
    expect(deveTocarSom('/', false)).toBe(true);
    expect(deveTocarSom('/', true)).toBe(false);
  });

  it('o site logado NÃO toca', () => {
    for (const rota of ['/community', '/keys', '/lives', '/ranks', '/profile', '/settings', '/admin']) {
      expect(deveTocarSom(rota, true), `${rota} nao devia ter som`).toBe(false);
    }
  });

  it('rota desconhecida é SILÊNCIO, e não música', () => {
    // A regra invertida ("tudo que nao e privado toca") faria toda rota NOVA
    // nascer com musica sem ninguem decidir. Aqui o desconhecido e mudo: uma
    // pagina nova aparece em silencio, alguem nota, e acrescenta.
    expect(deveTocarSom('/rota-que-ainda-nao-existe', false)).toBe(false);
  });
});

describe('acento do fundo por seção', () => {
  it('toda seção do site logado tem cor, e ela é um hex', () => {
    for (const rota of ['/', '/community', '/keys', '/lives', '/ranks', '/profile', '/settings']) {
      expect(acentoDaSecao(rota), `${rota} sem cor de fundo`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('painel de equipe NÃO tem fundo', () => {
    // Painel e ferramenta de trabalho: quem esta ali le log e decide punicao.
    // Movimento atras desse texto atrapalha em vez de ambientar.
    for (const rota of PREFIXOS_SEM_FUNDO) {
      expect(acentoDaSecao(rota), `${rota} nao devia ter fundo`).toBeUndefined();
    }
  });

  it('a raiz vem por ÚLTIMO na lista, senão engoliria todas', () => {
    // `/` casa com qualquer caminho por `startsWith`. Se subisse na lista, o
    // mural e as lives ganhariam a cor do feed sem ninguem perceber.
    expect(PREFIXOS_COM_ACENTO[PREFIXOS_COM_ACENTO.length - 1]).toBe('/');
  });

  it('caminho que não é string não estoura', () => {
    expect(acentoDaSecao(undefined)).toBeUndefined();
    expect(acentoDaSecao(null)).toBeUndefined();
  });
});
