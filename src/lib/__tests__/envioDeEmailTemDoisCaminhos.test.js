import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * TRAVA das propriedades do envio de e-mail que, se caírem, param o CADASTRO.
 *
 * ── Por que um teste que lê o ARQUIVO, e não a função ───────────────────────
 *
 * `send-email` é uma Edge Function em Deno: ela não roda no Vitest, e chamá-la
 * de verdade exigiria mandar e-mail — com o segredo do hook, contra a produção.
 * Então esta trava faz o que dá para fazer com honestidade: **conferir que as
 * propriedades continuam escritas no código**, e dizer alto que ela não prova
 * o envio.
 *
 * Não é o mesmo que testar. É melhor do que nada, e a diferença está escrita
 * aqui para ninguém confundir uma coisa com a outra (§1.1).
 *
 * ── As três propriedades, e o estrago de cada uma ───────────────────────────
 *
 * 1. **Dois caminhos, com o relay ganhando quando existe.** É o que torna a
 *    migração para outro provedor uma ação de painel: quatro segredos e pronto,
 *    sem deploy. Se alguém "simplificar" removendo um dos ramos, ou o dono
 *    perde o caminho de volta, ou a migração vira mudança de código no meio de
 *    um cadastro quebrado.
 *
 * 2. **`secure` decidido pela PORTA.** 465 é TLS implícito; 587 começa em claro
 *    e sobe com STARTTLS. `secure: true` fixo na 587 trava o handshake **sem
 *    mensagem útil** — o sintoma é "cadastro não chega e-mail", que é o pior
 *    tipo de falha para diagnosticar.
 *
 * 3. **Configuração faltando GRITA.** Sem isso, credencial errada devolve 500
 *    para o GoTrue e some: a pessoa vê "erro ao cadastrar", ninguém é avisado,
 *    e o site fica de pé aparentando funcionar (§1.5).
 *
 * ── O que ela NÃO cobre, dito antes de alguém confiar demais ────────────────
 *
 * Que o e-mail chega. Que a senha do relay está certa. Que o remetente foi
 * verificado no provedor. Nada disso é verificável a partir do repositório —
 * a prova é um cadastro de verdade depois de trocar os segredos.
 */
const FONTE = 'supabase/functions/send-email/index.ts';

describe('o envio de e-mail mantém as propriedades que seguram o cadastro', () => {
  const codigo = readFileSync(FONTE, 'utf8');

  it('a fonte foi mesmo lida', () => {
    // Sem isto, renomear a função deixaria todos os testes abaixo verdes sobre
    // uma string vazia — verde que não verificou nada é pior que vermelho.
    expect(codigo.length, `${FONTE} veio vazio — a função mudou de lugar?`)
      .toBeGreaterThan(2000);
  });

  it('existem DOIS caminhos, e o relay vence quando está configurado', () => {
    expect(codigo,
      'o ramo do relay SMTP sumiu de send-email.\n'
      + '  Com ele, trocar de provedor e colar quatro segredos no painel.\n'
      + '  Sem ele, vira mudanca de codigo + deploy — e provavelmente com o\n'
      + '  cadastro ja quebrado, que e a pior hora para mexer nisso.')
      .toMatch(/const\s+usandoRelay\s*=\s*Boolean\(SMTP_HOST\)/);

    expect(codigo,
      'o caminho do Gmail sumiu. Ele e o CAMINHO DE VOLTA: hoje e o que esta\n'
      + '  em producao, e enquanto SMTP_HOST nao existir e ele que envia.')
      .toMatch(/service:\s*"gmail"/);
  });

  it('o modo seguro do TLS é decidido pela porta, não fixo', () => {
    expect(codigo,
      '`secure` deixou de depender da porta em send-email.\n\n'
      + '  465 = TLS implicito. 587 = começa em claro e sobe com STARTTLS.\n'
      + '  Fixar `secure: true` numa 587 TRAVA o handshake, e o sintoma que\n'
      + '  chega ate voce e "nao recebi o e-mail de cadastro" — sem erro util\n'
      + '  em lugar nenhum. Mantenha `secure: SMTP_PORT === 465`.')
      .toMatch(/secure:\s*SMTP_PORT\s*===\s*465/);
  });

  it('a severidade da recusa não é decidida só pelo motivo', () => {
    // `[05/09]` "assinatura invalida" e produzida por DOIS eventos com pesos
    // opostos: um estranho batendo na porta (comum, inofensivo) e o
    // SEND_EMAIL_HOOK_SECRET errado (raro, fatal). Marcar o comum como
    // `critical` fazia o CI gritar todo dia — 72 eventos em 7 dias, sempre em
    // pares —, e alarme que grita a toa ensina a ignorar o nivel onde a falha
    // real vai aparecer (§0.2, 4a regra).
    expect(codigo,
      'o discriminador de severidade sumiu de send-email.\n'
      + '  Sem ele a recusa volta a ser `critical` por padrao, e o proprio\n'
      + '  portao `e2e/portas-fechadas.mjs` reabastece a trilha de alarme falso.\n'
      + '  CUIDADO ao "consertar" isso com um cabecalho que o teste manda para\n'
      + '  se identificar: cabecalho e controlado por quem chama, entao qualquer\n'
      + '  atacante mandaria o mesmo e apagaria o proprio rastro.')
      .toMatch(/pareceChamadaDoGoTrue\(rawBody\)/);

    expect(codigo,
      'a razao da severidade deixou de ser GRAVADA na linha.\n'
      + '  Quem abrir o registro daqui a seis meses precisa saber por que\n'
      + '  aquela recusa era warning e nao critical.')
      .toMatch(/corpo_parece_gotrue/);
  });

  it('configuração faltando grita em vez de falhar calado', () => {
    expect(codigo,
      'o aviso de credencial ausente sumiu de send-email.\n'
      + '  Sem ele, secret errado devolve 500 para o GoTrue e some: a pessoa ve\n'
      + '  "erro ao cadastrar", ninguem e avisado, e o site segue de pe\n'
      + '  aparentando funcionar. E o §1.5 na letra.')
      .toMatch(/gritar\([\s\S]{0,200}nao configurado/);

    expect(codigo,
      'a mensagem de falha deixou de dizer QUAL caminho estava em uso.\n'
      + '  Com dois provedores possiveis, "SMTP recusou" sem dizer qual manda\n'
      + '  voce investigar o provedor errado.')
      .toMatch(/caminho:\s*usandoRelay/);
  });
});
