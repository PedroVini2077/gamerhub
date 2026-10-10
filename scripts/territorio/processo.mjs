/**
 * O território dos documentos que descrevem como NÓS TRABALHAMOS.
 *
 * `[10/10]` A outra metade do mapa — ver `sistema.mjs` para o motivo do corte
 * e por que o recorte é contíguo.
 *
 * Aqui estão: os READMEs de `supabase/`, os documentos de território VAZIO de
 * propósito (decisão e visão não envelhecem por commit), o `README.md`, o
 * `CLAUDE.md` e os `docs/regras/` — que são regra executável e, até 02/09,
 * eram os únicos documentos sem vigilância nenhuma.
 */
export const PROCESSO = {
  // `[02/09]` Os dois READMEs de `supabase/` entraram quando o varredor passou
  // a olhar todo `.md` rastreado, e não só `docs/`. Eles descrevem sistema vivo
  // — como publicar Edge Function, como versionar migration — e apodrecem igual
  // a qualquer outro; só estavam fora do radar por causa da pasta.
  'supabase/functions/README.md': ['supabase/functions'],
  'supabase/migrations/README.md': ['supabase/migrations'],

  // ── Território vazio DE PROPÓSITO (ver o cabeçalho) ───────────────────────
  // Mapa de possibilidades, nao de codigo: nenhuma pasta o torna velho. Ele
  // envelhece por DECISAO (uma ideia sai daqui e vira item), e isso e coisa que
  // uma pessoa registra e nenhum script detecta — mesma razao do DECISOES.md.
  // `[08/10]` A auditoria do Android. Vazio pelo mesmo motivo: ele descreve um
  // caminho POSSIVEL, nao codigo que existe. Quando a Fase 3 criar `android/`,
  // esta entrada passa a apontar para ela — e ate la apontar para qualquer
  // pasta faria o relatorio mensal cobrar atualizacao de algo que nao mudou.
  'docs/PLANO-ANDROID.md': [],
  // `[09/10]` O estudo de cosmeticos. Vazio pelo MESMO motivo dos dois acima:
  // ele descreve um sistema que ainda nao existe. Apontar para
  // `components/ui/Avatar.jsx` faria o relatorio mensal cobrar atualizacao do
  // estudo toda vez que alguem mexesse no avatar por outro motivo — e o estudo
  // envelhece por DECISAO dele, nao por commit nosso.
  'docs/PLANEJAMENTO-COSMETICOS.md': [],
  'docs/PROMPT-CONTINUIDADE-COSMETICOS.md': [],
  'docs/VISAO-DE-FUTURO.md': [],
  'docs/DECISOES.md': [],
  'docs/DECISOES-FERRAMENTAL.md': [],
  'docs/MANIFESTO.md': [],
  'BACKLOG.md': [],

  // ── `[17/09]` O README SAIU DA LISTA DE VAZIOS, e o motivo é um erro meu ──
  //
  // Ele estava aqui em cima, junto com `DECISOES.md` e `VISAO-DE-FUTURO.md`.
  // Aqueles dois são mapas de possibilidade e de história: nenhum commit os
  // torna falsos. **O README não é dessa família.** Ele AFIRMA coisas sobre o
  // código — quais dependências o projeto tem, quais comandos existem, o que a
  // landing é. Afirmação sobre código envelhece quando o código muda.
  //
  // O custo do erro, encontrado pelo dono e não por portão nenhum: o README
  // anunciava `@react-three/fiber` e `three` como dependências de produção e
  // descrevia a landing como "animada com cena 3D". As duas bibliotecas
  // **não existem** no projeto desde 11/09 — zero ocorrências no
  // `package.json` e em `src/`. Ficou seis dias afirmando o que não é, e o
  // relatório mensal nunca o citou, porque território vazio significa
  // "não vigie por commit". Verde permanente é diferente de correto.
  //
  // ── Por que SÓ o `package.json`, e não `src/` inteiro ────────────────────
  //
  // O README responde "o que é" e "como rodar". Dar-lhe `src/` o faria
  // aparecer em toda issue mensal, e portão que sempre grita ensina a ignorar
  // o canal (§0.2, 4ª regra). O `package.json` é o arquivo mínimo que torna
  // este documento falso: é dele que saem a tabela de dependências e a lista
  // de comandos — e é ele que teria apontado ESTE caso, porque a saída da cena
  // 3D foi, literalmente, a remoção de duas linhas dali.
  'README.md': ['package.json'],

  // ── As regras, e a ligação delas é outra ──────────────────────────────────
  //
  // Os cinco estavam de fora do portão até 02/09: o `CLAUDE.md` com território
  // VAZIO (na lista só para não ser acusado de não mapeado, mas nunca
  // conferido), e os quatro `docs/regras/` invisíveis porque o varredor não
  // entrava em subpasta. São os arquivos que comandam todo o resto.
  //
  // O território deles não é "o código que descrevem" — é **o mecanismo que os
  // cumpre**. Uma regra sobre banco envelhece quando o portão do banco muda;
  // uma regra sobre documentação envelhece quando os portões de documentação
  // mudam.
  'CLAUDE.md': [
    'scripts/inicio-de-sessao.sh',
    'scripts/fim-de-sessao.mjs',
    '.github/workflows/ci.yml',
  ],
  'docs/regras/POSTURA.md': [
    'e2e/portas-fechadas.mjs',
    'e2e/portas-do-banco.mjs',
    'src/lib/tabelasSemUpdate.js',
  ],
  // `[24/09]` Saiu do CLAUDE.md quando ele bateu no próprio teto de 900
  // linhas. O território são os arquivos que definem o que cada cota conta:
  // mexer no que a Vercel constrói, ou ligar Edge Function nova, muda o
  // inventário que este arquivo afirma.
  'docs/regras/COTAS.md': [
    'vercel.json',
    'scripts/vercel-ignore.sh',
    'supabase/functions',
    'src/lib/tetoDeEventos.js',
  ],
  'docs/regras/BANCO.md': [
    'supabase/migrations',
    'e2e/portas-do-banco.mjs',
    'src/lib/tabelasSemUpdate.js',
  ],
  'docs/regras/AUDITORIA.md': [
    'scripts/mapa-de-arquivos.mjs',
    'scripts/segredos-vazados.mjs',
    'scripts/numeros-do-projeto.mjs',
    'src/lib/__tests__/varrerFontes.js',
  ],
  // `[03/09]` O território dele é o mecanismo que o cumpre: o BACKLOG virou
  // memória operacional, e o mapa de territórios é a ferramenta que o §9.4
  // manda consultar. Mexer nos dois muda o que o arquivo afirma.
  'docs/regras/EXECUCAO.md': [
    'scripts/territorio.mjs',
    'scripts/fim-de-sessao.mjs',
    'scripts/inicio-de-sessao.sh',
  ],
  // `[24/09]` Ele é o INVENTÁRIO dos portões e robôs. Portão novo, robô novo
  // ou trava nova torna a tabela dele incompleta — e tabela que se apresenta
  // como inventário e não é deixa de ser verdade para quem a lê.
  'docs/regras/MECANISMOS.md': [
    'scripts',
    '.github/workflows',
    'e2e',
    'src/lib/__tests__',
  ],
  'docs/regras/DOCUMENTACAO.md': [
    'scripts/documentacao-quebrada.mjs',
    'scripts/documentacao-envelhecida.mjs',
    'scripts/documentacao-a-revisar.mjs',
    'scripts/territorio-coberto.mjs',
    'scripts/numeros-do-projeto.mjs',
    'scripts/mapa-de-arquivos.mjs',
  ],
};
