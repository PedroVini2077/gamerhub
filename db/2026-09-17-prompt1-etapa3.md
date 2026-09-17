# PROMPT 1 · Etapa 3 — dados estruturados e acessibilidade

**Data:** 17/09/2026 · **Camadas:** 3 (JSON-LD) e 4 (acessibilidade)
**Regra que mandou nesta etapa:** *"NÃO invente dados estruturados. Não coloque
avaliações falsas, preços inexistentes, informações inexistentes, links falsos,
dados que não aparecem no site"*.

---

## O método, antes do resultado

Medido em navegador real (Playwright contra o `dist` servido localmente), em
**5 rotas**: `/`, `/login`, `/sobre`, `/termos`, `/privacidade`. Não é auditoria
de linter — é o DOM depois do React montar.

O que foi contado em cada rota: botão sem nome acessível, link sem texto,
imagem sem `alt`, salto de nível de cabeçalho, `lang` no `<html>`, e a área de
toque de todo alvo clicável.

---

## O diagnóstico — e ele foi majoritariamente BOM

| O que foi medido | Resultado |
| --- | --- |
| botões sem nome acessível | **0** nas 5 rotas |
| links sem texto | **0** |
| imagens sem `alt` | **0** |
| salto de nível de cabeçalho (`h1` → `h3`) | **nenhum** |
| `lang` no `<html>` | presente, `pt-BR` |
| páginas sem `<h1>` | **1** — `/login` |
| alvos de toque abaixo de 24×24 | **1** |

Isto precisa ser dito porque é o contrário do que eu esperava encontrar: a
acessibilidade deste projeto já estava em bom estado. A regra do `CLAUDE.md`
sobre `aria-label` em botão só-ícone vinha sendo cumprida, e aparece no número.

### A contagem que eu errei primeiro, e ela era minha

A primeira passagem acusou **15 a 17** alvos de toque pequenos. Era **falso**:
eu estava medindo links de texto em linha, que são naturalmente baixos porque
acompanham a altura da fonte — um link dentro de um parágrafo não é um alvo de
polegar, é uma palavra.

Refinado para o que a regra realmente cobre (botão e link **só-ícone**, sem
texto ao lado), o número real é **1**.

Registro isto porque um relatório que dissesse "17 problemas de acessibilidade
corrigidos" seria inflação de entrega (§1.1) — e porque a lição é reaproveitável:
**um detector que acusa 17 de 17 candidatos está medindo a coisa errada**, não
achando uma epidemia.

---

## Camada 3 — dados estruturados

### O que entrou

Um bloco `application/ld+json` no `index.html`, com **um** tipo: `WebSite`.
Nome, URL, descrição e idioma — os quatro existem na página, em texto visível.

Fica no HTML estático e **não** no `MetaDaRota`: dado estruturado é lido por
quem não executa JavaScript com mais frequência do que o título.

### O que ficou de FORA, com o motivo

Esta é a parte que interessa, porque a etapa era sobre não mentir.

| Tipo | Por que não entrou |
| --- | --- |
| `Organization` | o GamerHub é um projeto, não uma organização com endereço, contato ou quadro de pessoas. E `sameAs` para o repositório no GitHub não é perfil de organização — é onde o código mora |
| `SearchAction` | declara uma **URL de busca**, e não há busca pública. Seria prometer ao buscador uma página que devolve 404 |
| `aggregateRating` | não existe avaliação nenhuma no site |
| `offers` / `price` | não existe cobrança |

### A trava, e ela é uma lista FECHADA

`src/lib/__tests__/dadosEstruturados.test.js`.

O jeito errado de travar isto seria "existe um bloco JSON-LD?" — verde para
sempre, inclusive com um `aggregateRating` inventado dentro. A trava é o
contrário: **uma lista do que este site tem direito de afirmar**, e tipo novo só
entra nela junto com a evidência de que o dado é real.

Ela também cruza o JSON-LD com o catálogo de `metaDaPagina.js`: se alguém
melhorar a descrição da landing, a do JSON-LD passa a divergir e o teste falha.
Sem isso o site diria uma coisa para a pessoa e outra para a máquina, e nenhuma
das duas estaria errada o bastante para alguém notar.

---

## Camada 4 — acessibilidade

### Achado 1 — `/login` não tinha `<h1>` nenhum. **Corrigido.**

A marca estava em dois `<span>` dentro de um `<div>`. Quem navega por cabeçalho
(leitor de tela) chegava numa página sem título principal e precisava percorrer
tudo para descobrir onde caiu — e esta é a porta de quem **ainda não entrou**.

A troca foi **só semântica**: o `preflight` do Tailwind zera margem e tamanho de
fonte de título, e as classes continuaram nos mesmos `<span>`. Conferido em
navegador depois da mudança: a caixa da marca continua em `top 236 · 448x36`.
Renderiza igual.

### Achado 2 — o botão de dispensar o aviso de som tinha 13×13. **Corrigido.**

O ícone tem 13 px e não havia padding, então a área que responde ao dedo era o
próprio ícone. `p-1.5 -m-1.5` leva a ~25×25 **sem mover nada**: o padding cresce
a área clicável, a margem negativa devolve o espaço ao layout.

Medido depois: **25×25**.

### Achado 3 — a landing tem DOIS `<h1>`. **Proposto, não mexido.**

A landing está declarada **área protegida** nesta auditoria. Dois `<h1>` não
quebram nada e não são erro de acessibilidade grave — são ambiguidade sobre qual
é o título da página. Fica como proposta no `BACKLOG.md`, para decisão dele.

---

## As travas, e a que era DECORAÇÃO

Quatro das cinco asserções foram provadas **reinjetando o bug** e vendo o teste
falhar com uma mensagem que ensina: `aggregateRating` falso, tipo `Organization`
sem justificativa, descrição do JSON-LD divergindo da landing, e o `h1` do
`/login`.

**A do `h1` passou VERDE na primeira tentativa com o bug reinjetado.** O regex
casava o `<h1>` de dentro do **comentário** que eu mesmo tinha acabado de
escrever explicando a mudança. Ela não travava nada.

> É a **quinta** vez que este projeto é mordido pela mesma coisa: trava que lê a
> PROSA em vez do CÓDIGO. Por isso a correção não foi ajustar o regex — foi
> cortar comentário de bloco e de linha **antes** de qualquer regex, num auxiliar
> (`semComentarios`) que fica disponível para a próxima.

Com o corte: código correto → **6 asserções passam**; bug reinjetado (tag de
volta para `<div>`) → falha dizendo *"A tela de entrada voltou a ficar sem
`<h1>`"*.

---

## O que a camada 3 da documentação pegou de quebra

`npm run docs` mandou abrir sete documentos. Três continham afirmação **falsa** —
e nenhuma tinha sumido de arquivo nenhum, que é justamente o que os portões
determinísticos não veem.

| Documento | O que dizia | O que é verdade (lido no `pg_proc`/`src`) |
| --- | --- | --- |
| `docs/BANCO.md` | `check_login_status` e `reset_login_attempts` estão entre as "chamadas pelo front" | **zero** chamadas em `src/` para as duas |
| `docs/SEGURANCA.md` | "a tela de login agora só lê, por `check_login_status`" | era fato em 28/08; a chamada saiu em 11/09 e a função foi revogada hoje |
| `docs/PAINEIS.md` | "o contador só zera em login bem-sucedido (`reset_login_attempts`)" | quem zera é o **hook**, com `DELETE FROM login_attempts` dentro do ramo `IF v_valid THEN`. A `reset_login_attempts` não participa |

As três corrigidas, com a evidência escrita ao lado.

### E um achado 🔵 que saiu daí

`reset_login_attempts()` é chamável por `authenticated` e **ninguém a chama**:
nem `src/`, nem Edge Function, nem outra função do banco (`prosrc ilike
'%reset_login_attempts%'` devolveu vazio). É porta morta da mesma família da
SEC-022, que fechei hoje pelo mesmo motivo.

**Severidade 🔵 Baixo, e a honestidade importa aqui:** hoje ela não faz nada,
porque `login_attempts` está vazia e continua vazia (o hook que a encheria é de
plano pago). O corpo dela é escopado por `auth.uid()`, então nem forjar alvo dá.
O risco é o do **dia em que o hook existir**: quem estiver com bloqueio temporário
e tiver uma sessão aberta em outra aba limpa o próprio bloqueio.

**Não revoguei.** Revogação é permissão, e permissão é 🟡 pelo §7 — proponho e
espero. A exceção do §1.3 é para brecha **explorável**, e esta não é hoje. Está
no `BACKLOG.md` com esta mesma análise.

> Nota de honestidade: a auditoria de 12/09 **leu** esta função e a liberou
> ("apaga só a linha do próprio e-mail"), o que estava certo quanto ao escopo.
> O que ninguém perguntou naquele dia foi *"e quem a chama?"* — e a resposta
> teria sido "ninguém" já naquela data.

---

## Portões, todos verdes

| | |
| --- | --- |
| `npm run build` | limpo |
| `npm run lint` | **0 erros**, 13 warnings (mesmo número de antes) |
| `npx vitest run` | **693 testes, 94 arquivos, todos verdes** |
| `npm run numeros` | 15 números reescritos em 4 documentos |
| `documentacao-quebrada` | nenhum documento cita arquivo inexistente |
| `mapa-de-arquivos` | os 388 arquivos de `src/` estão no `ARQUITETURA.md` |
| `territorio-coberto` | 54 unidades, todas com documento responsável |
| `segredos-vazados` | 812 arquivos rastreados, nenhum segredo |

---

## O que esta etapa NÃO fez

- **Não mediu impacto em buscador.** JSON-LD e `<h1>` são afirmações sobre a
  página; se o Google vai usá-las e como, só o Search Console diz, com semanas
  de atraso. Nada aqui foi entregue como "vai subir o ranking".
- **Não tocou na landing.** Os dois `<h1>` dela continuam lá, por decisão dele.
- **Não testou com leitor de tela de verdade.** O que foi medido é a árvore de
  acessibilidade do navegador, que é onde o leitor bebe — mas não é a mesma
  coisa que ouvir a página no NVDA ou no VoiceOver. Isso continua sendo leitura
  humana.
