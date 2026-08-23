// Capturado da versão 18 implantada em 23/08/2026 — ver ../README.md.
//
// APOSENTADA em 23/08/2026. Não apague este arquivo sem ler o porquê.
//
// O que ela fazia: dois DELETEs em `posts` (lives com prazo vencido, e purga
// do que foi soft-deletado há mais de 30 dias), rodando com
// SUPABASE_SERVICE_ROLE_KEY.
//
// O problema: `verify_jwt: false` e nenhuma checagem no corpo. Qualquer pessoa
// da internet disparava. O estrago em DADOS era nulo (idempotente, só fazia o
// que o agendamento faria), mas cada chamada rodava duas varreduras de DELETE
// em `posts` — dá para martelar de fora e consumir invocação de Edge Function e
// carga de banco de graça. A resposta ainda contava quantas linhas saíram.
//
// A correção não foi trancar a porta, foi não ter porta: o trabalho é SQL puro,
// virou `public.cleanup_expired_posts()` e o cron (jobid 1) chama o banco
// direto, sem dar a volta pela internet.
//
// Este corpo fica aqui como lápide até a função ser apagada pelo dashboard
// (o MCP não apaga Edge Function). `verify_jwt` ligado, e não faz nada.

Deno.serve(() =>
  new Response(
    JSON.stringify({
      status: "aposentada",
      substituida_por: "public.cleanup_expired_posts() — cron jobid 1",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
