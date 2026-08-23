# Operação

> O que fazer quando algo quebra, e o que o projeto faz sozinho para avisar que
> quebrou. Este é o arquivo para abrir num aperto.

## Observabilidade — a falha tem que gritar

> Regra de origem: `CLAUDE.md` §1.5. De 11 achados numa única rodada de testes,
> **quatro falhavam em silêncio absoluto** — nada estourava, nada aparecia na
> tela, nenhum teste quebrava. O pior deles (a moderação por IA) esteve quebrado
> em **26 de 26 chamadas por semanas**, detectando corretamente e nunca
> aplicando nada. O sistema não tinha defeito de detecção; estava mudo.

- **Sentry no frontend** (`lib/monitoring.js`) — só **erro**, sem tracing e sem
  Session Replay, que são os que consomem cota. Ligado no `ErrorBoundary`, que
  até então só fazia `console.error`: a tela "Algo deu errado" aparecia e
  ninguém do outro lado ficava sabendo.
  - `sendDefaultPii: false` e um `beforeSend` que **remove `access_token` e
    `refresh_token` da URL**. O Supabase devolve esses tokens no fragmento na
    confirmação de email e na recuperação de senha; sem a limpeza, um erro
    nessas telas mandaria uma **sessão válida** para dentro do relatório.
  - O DSN fica **no código**, não em variável de ambiente: ele é público por
    natureza (vai no bundle), e depender da Vercel significaria que esquecer de
    configurá-lo num deploy futuro apagaria o monitoramento sem ninguém notar —
    construindo a falha silenciosa que ele existe para acabar.
  - Custo medido: **+27,8 KB gzip** (507 → 535 KB de JS total).
- **Falhas de servidor viram trilha** — `registrar_falha_de_moderacao` grava
  `edge_function_error` em `admin_logs`, porque o corpo da resposta sozinho não
  basta quando o chamador é fire-and-forget.

## Resiliência — quando o banco cai

O site detecta sozinho que perdeu o Supabase (projeto pausado por egress, por
restrição de serviço, ou de propósito), avisa e leva todo mundo para a landing
— a única página que **não depende do banco para nada**. Antes disso, pausar
exigia editar o código e escrever "projeto pausado" na landing à mão.

**O risco desta funcionalidade é o falso positivo**, não a detecção: derrubar o
site porque o wi-fi de alguém piscou seria pior que o problema. Quatro defesas
em `lib/dbHealth.js`, que instrumenta o `fetch` do cliente Supabase:

| Defesa | Por quê |
| --- | --- |
| Só falha de **infraestrutura** conta (`fetch` estourou, ou 5xx) | 4xx significa que o banco respondeu — é RLS ou erro de aplicação, e negar é normal aqui |
| **3 falhas seguidas**, e qualquer resposta boa zera | uma falha isolada não é queda |
| **Sondagem independente** antes de declarar | se alguém atender, foi instabilidade |
| Requisição **abortada** não conta | troca de tela cancela requisição o tempo todo |

Volta sozinho: já fora do ar, sonda a cada 20s.

O motivo da pausa (`site_config.pause_reason`, editável na aba Site) é lido
**enquanto há banco** e guardado no navegador — porque se o banco caiu, o motivo
não pode vir de lá. Pausa planejada mostra o motivo real; queda inesperada, ou
primeira visita, mostra texto genérico.

## Portão de qualidade automático

`.github/workflows/ci.yml`, a cada PR e push na `main`:

- `lint` (0 erros) · `npm test` · `build` · `npm audit --audit-level=high`
- **piso de 125 testes** — o CI quebrando é o caso fácil, fica vermelho e
  alguém olha; o perigoso é ele **passar sem testar nada** (arquivo renomeado,
  `describe.skip` esquecido). Ao adicionar testes, subir o piso junto.
- job de **fumaça** — 12 rotas num Chromium real, alcançando o Supabase. Só
  roda com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas *Variables* do
  repositório; sem elas seria "0/12 rotas", falha que não diz nada.

`.github/dependabot.yml`: PR semanal agrupado por patch/minor, teto de 3.
**Major fica de fora de propósito** — já quebrou o site uma vez (o upgrade do
react-router que motivou o teste de fumaça existir).

---


---

[← voltar para o README](../README.md)
