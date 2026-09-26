import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MODELOS_CONFERIDOS, MODELOS_REPROVADOS } from '../modelosConferidos';

/**
 * `[26/09]` O modelo que a Edge Function chama precisa existir **para a nossa
 * conta**, e não só existir.
 *
 * O dono recebeu `HTTP 404` no primeiro clique em "Redigir rascunho". O modelo
 * era de produção na Groq e eu tinha conferido isso — mas é Enterprise, e o
 * plano grátis não o alcança. O Groq responde `404` nesse caso, então a
 * mensagem nem dizia "sem acesso".
 *
 * **O que esta trava NÃO faz:** ela não chama a Groq. Não dá — exigiria a
 * chave no CI, e trocar incerteza de monitoramento por credencial exposta é a
 * conta ruim de sempre (§0.2). O que ela faz é impedir que uma string de modelo
 * entre sem alguém ter aberto a tabela de limites **do nosso plano** e olhado.
 */

const FUNCOES = [
  ['redigir-materia', 'supabase/functions/redigir-materia/index.ts'],
  ['radar-de-pautas', 'supabase/functions/radar-de-pautas/index.ts'],
];

describe('o modelo de cada Edge Function foi conferido no nosso plano', () => {
  it('a extração acha a string do modelo — senão a trava aprova o vazio', () => {
    for (const [nome, caminho] of FUNCOES) {
      const m = readFileSync(caminho, 'utf8').match(/const MODELO = "([^"]+)"/);
      expect(m, `nao achei \`const MODELO = "..."\` em ${nome}. O formato mudou? `
        + 'Sem isto a trava passa verde sem olhar modelo nenhum.').toBeTruthy();
    }
  });

  it('nenhuma função usa modelo fora da lista de conferidos', () => {
    const fora = FUNCOES
      .map(([nome, caminho]) => [nome, readFileSync(caminho, 'utf8').match(/const MODELO = "([^"]+)"/)?.[1]])
      .filter(([, id]) => !Object.hasOwn(MODELOS_CONFERIDOS, id));

    expect(fora.map(([n, id]) => `${n} -> ${id}`), 'estas funcoes usam modelo que '
      + 'ninguem conferiu no NOSSO plano.\n\n'
      + '  A pergunta nao e "o modelo existe?" nem "e de producao?" — o que deu '
      + '404 na cara do dono era um modelo de producao.\n'
      + '  A pergunta e: ELE APARECE NA TABELA DE LIMITES DO PLANO QUE NOS '
      + 'PAGAMOS?\n'
      + '  Abra console.groq.com/docs/rate-limits, confira, e registre em '
      + 'src/lib/modelosConferidos.js com a data e o metodo.').toEqual([]);
  });

  it('nenhum modelo REPROVADO voltou para uma função', () => {
    const voltaram = [];
    for (const [nome, caminho] of FUNCOES) {
      const id = readFileSync(caminho, 'utf8').match(/const MODELO = "([^"]+)"/)?.[1];
      if (id && Object.hasOwn(MODELOS_REPROVADOS, id)) voltaram.push(`${nome} -> ${id}`);
    }
    expect(voltaram, 'modelo REPROVADO de volta:\n'
      + voltaram.map((v) => `  ${v}`).join('\n')).toEqual([]);
  });

  it('cada função sabe lidar com JSON embrulhado em cerca de markdown', () => {
    // `response_format: json_object` pede JSON puro e a maioria dos modelos
    // obedece — mas trocar de modelo troca esse comportamento, e um ```json em
    // volta derrubaria o parse. A tela diria "a IA respondeu algo que eu nao
    // entendi" sobre uma resposta correta.
    for (const [nome, caminho] of FUNCOES) {
      expect(readFileSync(caminho, 'utf8'), `${nome} perdeu o \`semCerca\` antes do `
        + 'JSON.parse').toMatch(/semCerca\(/);
    }
  });
});
