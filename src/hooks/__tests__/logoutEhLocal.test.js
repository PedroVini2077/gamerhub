import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * TRAVA: cada saída do site usa o escopo CERTO — e eles não são todos iguais.
 *
 * ── A decisão que originou isto ─────────────────────────────────────────────
 *
 * `[05/09]` O dono: *"deslogar no celular não pode deslogar no PC, não faz
 * sentido, a não ser que tenha uma aba pra identificar dispositivos conectados,
 * tipo Instagram"*.
 *
 * O `supabase-js` usa `scope: 'global'` **por omissão** — quem escrever
 * `supabase.auth.signOut()` sem argumento nenhum reintroduz o comportamento
 * antigo achando que não mudou nada. É a forma mais fácil de perder isto: não
 * por alguém decidir o contrário, mas por escrever o caminho curto.
 *
 * ── E por que a resposta NÃO é "local em tudo" ──────────────────────────────
 *
 * Escrevi esta trava exigindo local em todo lugar e ela estava errada. Existe
 * uma saída onde derrubar todas as sessões é justamente o ponto: a que vem
 * **depois de redefinir a senha**. Quem redefine senha costuma estar fazendo
 * exatamente o que o logout global não conseguia fazer sozinho — expulsar
 * alguém. Ali, global é a escolha certa.
 *
 * Por isso a lista abaixo diz o escopo esperado de cada uma, com o motivo. Ela
 * é o lugar onde essa distinção fica escrita; sem ela, alguém "uniformiza" os
 * dois um dia e ninguém lembra que a diferença era proposital.
 *
 * ── Por que varre o CÓDIGO, e por que precisa existir ───────────────────────
 *
 * O que precisa ser verdade é uma afirmação sobre TODOS os pontos de saída, não
 * sobre um. E quando quebra, **ninguém vê**: quem está no PC só descobre na
 * próxima renovação de token, noutra hora, noutra tela, sem pista da causa. São
 * as três respostas "nada" do §1.5 — o que obriga a verificação a acontecer
 * antes, no CI.
 */
const SAIDAS = [
  {
    arquivo: 'src/hooks/useAuth.jsx',
    quantas: 2,
    escopo: "{scope:'local'}",
    porque: 'o botão "Sair" e a saída de quem foi banido encerram a sessão '
      + 'DESTE aparelho — derrubar os outros só faria sentido com uma tela de '
      + 'aparelhos conectados, que o site não tem',
  },
  {
    arquivo: 'src/pages/AuthConfirm.jsx',
    quantas: 1,
    escopo: '',
    porque: 'esta é a saída DEPOIS DE REDEFINIR A SENHA, e aqui global é o '
      + 'ponto: quem troca a senha costuma estar expulsando alguém. Deixar '
      + 'local manteria viva a sessão que a troca de senha existe para matar',
  },
];

describe('cada saída do site usa o escopo certo', () => {
  it.each(SAIDAS)('$arquivo', ({ arquivo, quantas, escopo, porque }) => {
    const codigo = readFileSync(arquivo, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    const chamadas = [...codigo.matchAll(/supabase\.auth\.signOut\(([^)]*)\)/g)];

    expect(chamadas.length,
      `esperava ${quantas} chamada(s) de signOut em ${arquivo} e achei `
      + `${chamadas.length}.\n`
      + '  Saida nova? Acrescente-a em SAIDAS neste teste COM O MOTIVO do\n'
      + '  escopo escolhido — sem isso ela nao e vigiada por ninguem.')
      .toBe(quantas);

    for (const [inteira, args] of chamadas) {
      expect(args.replace(/\s/g, ''),
        `\`${inteira.trim()}\` em ${arquivo} esta com o escopo errado.\n\n`
        + `  Esperado: ${escopo || '(sem argumento — global)'}\n`
        + `  Porque: ${porque}.\n\n`
        + '  Lembre que o supabase-js usa GLOBAL por omissao, entao\n'
        + '  `signOut()` sem argumento revoga TODAS as sessoes da conta.\n'
        + '  Quando isso quebra do lado errado, NINGUEM ve: quem fica no PC so\n'
        + '  descobre na proxima renovacao de token, sem pista da causa.')
        .toBe(escopo);
    }
  });
});
