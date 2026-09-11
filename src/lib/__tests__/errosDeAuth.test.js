import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { mensagemDeErroDeAuth, ID_DO_TOAST_DE_AUTH } from '../errosDeAuth';

/**
 * O erro do login chega em português, e uma caixa por vez.
 *
 * ── O que o dono viu, e por que virou trava ─────────────────────────────────
 *
 * `[11/09]` Print do celular: cinco caixas empilhadas com
 * **"Invalid login credentials"**, em inglês. Duas falhas num print só — o
 * texto cru do Supabase chegando na tela, e um toast por clique.
 *
 * A regressão é fácil de voltar: basta alguém escrever `toast.error(error.message)`
 * de novo, que é a forma mais natural de escrever a linha. Por isso a trava
 * varre o `Login.jsx` além de testar a função.
 */
describe('erros de autenticação', () => {
  it('traduz a mensagem que o dono viu', () => {
    expect(mensagemDeErroDeAuth({ message: 'Invalid login credentials' }))
      .toBe('E-mail ou senha incorretos.');
  });

  it('não depende da caixa das letras', () => {
    // O texto do GoTrue já mudou de caixa entre versões; comparar cru
    // deixaria a tradução de funcionar sem ninguém perceber.
    expect(mensagemDeErroDeAuth({ message: 'INVALID LOGIN CREDENTIALS  ' }))
      .toBe('E-mail ou senha incorretos.');
  });

  it('erro SEM mensagem não vira "senha incorreta"', () => {
    // Rede caída devolve erro sem texto. Dizer "senha incorreta" aqui mandaria
    // a pessoa trocar uma senha que está certa (§1.5).
    const m = mensagemDeErroDeAuth({});
    expect(m).toMatch(/conex/i);
    expect(m).not.toMatch(/incorret/i);
  });

  it('mensagem DESCONHECIDA aparece inteira, em vez de ser engolida', () => {
    // §4: fallback silencioso é proibido. Um "ocorreu um erro" genérico
    // esconderia justamente o caso novo, que é quando a informação importa.
    const m = mensagemDeErroDeAuth({ message: 'Some brand new GoTrue error' });
    expect(
      m,
      'Mensagem desconhecida foi trocada por um texto genérico. Isso é o '
      + 'fallback silencioso do §4: o caso NOVO some justo quando precisava '
      + 'ser visto. O desconhecido tem que chegar na tela com o texto original.',
    ).toContain('Some brand new GoTrue error');
  });

  it('o Login.jsx NÃO joga `error.message` cru na tela', () => {
    const fonte = readFileSync('src/pages/Login.jsx', 'utf8');
    expect(
      fonte,
      'Voltou um `toast.error(error.message)` no Login.jsx. Isso põe o texto '
      + 'CRU do Supabase na tela — em ingles, num site em portugues. Foi o que '
      + 'o dono fotografou em 11/09. Use `mensagemDeErroDeAuth(error)`.',
    ).not.toMatch(/toast\.error\(\s*error\.message\s*\)/);
  });

  it('todo toast de auth usa o MESMO id, para não empilhar', () => {
    const fonte = readFileSync('src/pages/Login.jsx', 'utf8');
    const comTraducao = [...fonte.matchAll(/toast\.error\(\s*mensagemDeErroDeAuth/g)].length;
    expect(
      comTraducao,
      'Nao achei nenhuma chamada traduzida no Login.jsx — o arquivo mudou de '
      + 'nome ou de forma, e esta trava passou a nao verificar nada.',
    ).toBeGreaterThanOrEqual(3);

    const comId = [...fonte.matchAll(
      /toast\.error\(\s*mensagemDeErroDeAuth\([^)]*\),\s*\{\s*id:\s*ID_DO_TOAST_DE_AUTH\s*\}/g,
    )].length;
    expect(
      comId,
      `${comTraducao - comId} chamada(s) de toast de auth sem `
      + '`{ id: ID_DO_TOAST_DE_AUTH }`. Sem o id, cada clique empilha uma caixa '
      + 'nova — o dono fotografou CINCO de uma vez em 11/09.',
    ).toBe(comTraducao);
  });

  it('o id existe e não é vazio', () => {
    expect(ID_DO_TOAST_DE_AUTH).toBeTruthy();
  });
});
