# Migrations

**Esta pasta é a verdade sobre o schema.** As <!--n:migrations-->152<!--/n-->
migrations aqui, aplicadas em ordem de nome, reconstroem o banco do zero.

## Por que ela existe

Até 27/08/2026 o schema vivia **só no Supabase**, e o repositório tinha um
`DATABASE_SCHEMA_BACKUP.sql` gerado em **11/06** — 48 migrations atrás. Ele
conhecia 52 funções; o banco tinha 71. Faltavam `lift_suspension`,
`registrar_falha_de_edge_function`, `registrar_falha_de_moderacao` e boa parte
do endurecimento de segurança de agosto.

E o README mandava usar aquele arquivo para recriar o banco. **A instrução era
falsa, e ninguém tinha como saber** — é falha silenciosa (`CLAUDE.md` §1.5)
aplicada a recuperação de desastre: só apareceria no dia em que alguém
precisasse dela.

O achado veio de conferir o projeto contra uma lista de camadas de engenharia
("Backups & Replication"), não de um teste. Mesmo problema que as Edge Functions
tinham antes de 23/08: a verdade num lugar só, sem histórico revisável.

## Como recriar o banco do zero

```bash
# em ordem, do mais antigo para o mais novo
for f in supabase/migrations/*.sql; do
  echo "-- $f"; cat "$f"; echo
done > /tmp/schema-completo.sql
```

Depois cole `/tmp/schema-completo.sql` no SQL Editor do Supabase.

**O que as migrations NÃO contêm** — precisa ser feito pelo dashboard:

- buckets do Storage e suas policies;
- secrets das Edge Functions (`OPENAI_API_KEY`, `GMAIL_*`,
  `SEND_EMAIL_HOOK_SECRET`, `GOOGLE_SAFE_BROWSING_KEY`, `HUGGINGFACE_API_KEY`);
- o Auth Hook de email apontando para a `send-email`;
- as próprias Edge Functions (elas estão em [`../functions/`](../functions/)).

## Como manter isto honesto

**Toda mudança de schema continua indo por `apply_migration`** — é o que garante
que ela entre no histórico do Supabase. Esta pasta é um **espelho** desse
histórico, e como todo espelho, pode ficar para trás.

Ao aplicar uma migration nova, acrescente o arquivo aqui **no mesmo PR**. O
nome segue o mesmo padrão: `<version>_<name>.sql`.

### `[02/09]` O hábito não bastou — e o estrago era exatamente o previsto

O parágrafo que estava aqui dizia: *"não existe teste comparando esta pasta com
o Supabase… o que protege aqui é o hábito"*. **O hábito falhou.** Em 02/09 o
banco tinha **151** migrations e esta pasta tinha **142**: nove nunca viraram
arquivo — o canal de contato inteiro, a idade mínima de 13 anos, a tabela de
aceite das políticas e os prazos de retenção.

Ou seja: durante quatro dias, recriar o banco a partir daqui produziria um
schema **sem nada de 29/08 em diante**, enquanto a primeira linha deste arquivo
prometia o contrário. É a mesma falha silenciosa que motivou a pasta a existir,
de volta — e ninguém teria como saber antes do dia em que precisasse.

**O que mudou, e por que agora dá para travar.** A objeção antiga era real, mas
específica demais: comparar **conteúdo** exige um token de gestão no CI — a
troca ruim já recusada no `portas-fechadas.mjs` e no alerta de cota do Sentry.
Comparar a **contagem**, não. A RPC `contagem_de_migrations()` devolve um
inteiro e é chamável com a anon key; o SQL das migrations já está num
repositório público, então o número não revela nada.

`scripts/espelho-de-migrations.mjs` roda no CI e **reprova** quando os dois
números divergem. Ele pegou a própria migration que o criou, na primeira
execução.

> **O que ele não pega, dito antes que alguém confie demais:** trocar um arquivo
> por outro mantém a contagem. Ele responde uma pergunta só — *o espelho tem o
> mesmo NÚMERO de migrations que o banco?* — e é a pergunta que teria evitado
> este caso.

## Como foram exportadas

Por uma função `SECURITY DEFINER` **temporária**, chamada com a conta de teste,
escrevendo direto no disco — para as 180 kB de SQL não passarem pelo contexto
do Claude. A função foi derrubada em seguida, e o risco foi avaliado antes:
expunha o histórico de schema a quem tem conta, por um minuto, e **este mesmo
histórico está num repositório público desde então**. Não era segredo.
