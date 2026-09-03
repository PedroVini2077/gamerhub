/**
 * Trava das brechas de 23/08 (CLAUDE.md §2: todo bug corrigido vira uma trava).
 *
 * As Edge Functions vivem só no Supabase — não estão no git. Isso significa
 * que **nenhum teste que lê o código-fonte consegue protegê-las**: basta um
 * deploy pelo dashboard, ou uma versão antiga restaurada, e a porta reabre sem
 * que nada no repositório mude. Um PR verde não provaria nada.
 *
 * Então a trava bate na porta de verdade e exige o 401. É o mesmo teste que
 * fizemos na mão ao fechar cada uma, agora rodando sozinho a cada PR.
 *
 * As três brechas que isto impede de voltar:
 *
 *   send-email             qualquer um na internet disparava email de
 *                          "redefinir senha" com a marca do site, para
 *                          qualquer endereço — e queimava a cota de ~500/dia
 *                          do Gmail, que é o que trava o cadastro de todo mundo
 *   moderate-links         a porta era decorativa: `if (!authHeader) 401` e
 *                          seguia em frente sem validar o token
 *   cleanup-expired-posts  rodava com service_role e apagava posts, sem
 *                          checagem nenhuma
 *   debug-hf               sobra de experimento, gastava a chave do Hugging
 *                          Face a cada chamada
 *
 * As duas últimas foram APAGADAS de vez em 27/08, e o esperado delas virou
 * 404. Função que não existe é a porta mais fechada que existe — mas a
 * verificação continua valendo, porque "apagada" é um estado que alguém pode
 * desfazer sem querer.
 *
 * Nenhuma destas requisições tem efeito colateral: todas devem ser RECUSADAS.
 * Se alguma passar, o teste falha — que é o ponto.
 *
 * Uso:  SUPABASE_URL=https://<projeto>.supabase.co node e2e/portas-fechadas.mjs
 */

const URL_BASE = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '')
  .replace(/\/+$/, '');

if (!URL_BASE) {
  console.error('\n  VITE_SUPABASE_URL nao definida — sem ela nao da para bater nas funcoes.\n');
  process.exit(2);
}

const FUNCOES = URL_BASE.replace('.supabase.co', '.functions.supabase.co');

/**
 * Cada caso descreve UMA forma de abuso que já funcionou, e o que tem que
 * acontecer agora. `esperado` é a lista de status aceitáveis: 401 é o corpo da
 * função (ou o gateway) recusando; 410 é a função aposentada.
 */
const CASOS = [
  {
    nome: 'send-email sem assinatura',
    caminho: '/send-email',
    corpo: {
      user: { email: 'trava-e2e@example.com' },
      email_data: { token_hash: 'trava', email_action_type: 'recovery' },
    },
    esperado: [401],
    estrago: 'email de "redefinir senha" com a marca do site para qualquer endereco',
  },
  {
    nome: 'send-email com assinatura falsa',
    caminho: '/send-email',
    cabecalhos: {
      'webhook-id': 'trava-e2e',
      'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
      'webhook-signature': 'v1,YXNzaW5hdHVyYS1mYWxzYQ==',
    },
    corpo: {
      user: { email: 'trava-e2e@example.com' },
      email_data: { token_hash: 'trava', email_action_type: 'recovery' },
    },
    esperado: [401],
    estrago: 'o mesmo, so que fingindo ser o GoTrue',
  },
  {
    nome: 'moderate-links com token inventado',
    caminho: '/moderate-links',
    cabecalhos: { Authorization: 'Bearer token-que-nao-existe' },
    corpo: {
      content_type: 'post',
      content_id: '00000000-0000-0000-0000-000000000000',
      url: 'https://example.com',
    },
    esperado: [401],
    estrago: 'queimar a cota de 10 mil consultas/dia do Safe Browsing',
  },
  // As duas abaixo foram APAGADAS de vez em 27/08. Para elas o esperado é 404:
  // função que não existe é a porta mais fechada que existe. Qualquer outra
  // resposta significa que alguém recriou a função — inclusive um 401, que
  // pareceria seguro e não é: seria a função de volta, só que com o gateway
  // ligado. O que a gente quer é que ela continue não existindo.
  {
    nome: 'cleanup-expired-posts segue apagada',
    caminho: '/cleanup-expired-posts',
    corpo: {},
    esperado: [404],
    estrago: 'rodar dois DELETE em posts com service_role, de graca, quantas vezes quiser',
    apagada: true,
  },
  {
    nome: 'debug-hf segue apagada',
    caminho: '/debug-hf',
    corpo: {},
    esperado: [404],
    estrago: 'gastar a chave do Hugging Face a cada chamada',
    apagada: true,
  },
];

console.log(`\n  Portas das Edge Functions em ${FUNCOES}\n`);

let falhas = 0;

for (const caso of CASOS) {
  let status;
  try {
    const r = await fetch(FUNCOES + caso.caminho, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(caso.cabecalhos ?? {}) },
      body: JSON.stringify(caso.corpo),
      signal: AbortSignal.timeout(30000),
    });
    status = r.status;
  } catch (e) {
    // Rede caindo não é a função estando aberta. Sai com 2 (ambiente), não 1.
    console.error(`\n  Nao consegui falar com ${caso.caminho}: ${e.message}`);
    console.error('  Isto e falha de rede, nao prova nada sobre a funcao.\n');
    process.exit(2);
  }

  // `[03/09]` PROJETO PAUSADO NÃO É PORTA ABERTA.
  //
  // Com o projeto Supabase em `INACTIVE`, o gateway responde **HTTP 540** a
  // tudo — e como 540 não está em nenhuma lista de `esperado`, esta trava
  // acusava as 5 portas de uma vez e escrevia *"alguem reimplantou uma Edge
  // Function sem a checagem de quem chama"*. Nada disso tinha acontecido: as
  // funções nem chegaram a rodar.
  //
  // Alarme que grita a coisa errada é o defeito do §0.2 (4ª regra) — ele ensina
  // a ignorar exatamente o canal onde a falha real vai aparecer. E era pior aqui
  // do que em outros lugares: uma acusação de porta de segurança reaberta é a
  // que mais merece ser levada a sério quando aparecer de verdade.
  //
  // A saída é a MESMA que este arquivo já usava para rede caindo, logo acima:
  // sair com 2 (ambiente). O CI continua vermelho — não dá para afirmar que as
  // portas estão fechadas sem conseguir bater nelas —, mas o motivo passa a ser
  // verdadeiro: **não foi verificado**, e não "foi verificado e está aberto".
  if (status >= 500) {
    console.error(`\n  Nao consegui conferir ${caso.caminho}: HTTP ${status}.`);
    console.error('  5xx aqui vem do GATEWAY, nao da funcao — 540 e o que a');
    console.error('  Supabase responde com o PROJETO PAUSADO. As funcoes nem');
    console.error('  chegaram a rodar, entao isto NAO prova nada sobre elas:');
    console.error('  nem que estao fechadas, nem que estao abertas.');
    console.error('\n  Para conferir de verdade, o projeto precisa estar ativo.\n');
    process.exit(2);
  }

  const ok = caso.esperado.includes(status);
  if (!ok) falhas++;
  const rotulo = ok ? 'OK    ' : (caso.apagada ? 'VOLTOU' : 'ABERTA');
  console.log(`  ${rotulo}  ${caso.nome.padEnd(38)} HTTP ${status}`
    + (ok ? '' : `  (esperado ${caso.esperado.join(' ou ')})`));
  if (!ok) {
    console.log(caso.apagada
      ? `          => esta funcao foi apagada de proposito e reapareceu.`
        + ` Se voltou mesmo, ela permite: ${caso.estrago}`
      : `          => volta a permitir: ${caso.estrago}`);
  }
}

if (falhas) {
  console.error(`\n  ${falhas} porta(s) reaberta(s).`);
  console.error('  Alguem reimplantou uma Edge Function sem a checagem de quem chama.');
  console.error('  Ver docs/SEGURANCA.md e db/2026-08-23-send-email-aberta-para-a-internet.md.\n');
  process.exit(1);
}

console.log(`\n  ${CASOS.length}/${CASOS.length} portas fechadas\n`);
