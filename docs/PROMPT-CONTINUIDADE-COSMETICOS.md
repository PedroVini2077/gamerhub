# Cosméticos — como RETOMAR este estudo

> Este documento existe para que a investigação de cosméticos possa continuar
> **numa sessão nova, sem o histórico da conversa**. Ele guarda o pedido
> original, o que já foi apurado, e o que falta.
>
> O estudo em si está em
> [`PLANEJAMENTO-COSMETICOS.md`](PLANEJAMENTO-COSMETICOS.md). **Leia aquele
> primeiro** — este aqui é o mapa, não o conteúdo.

[← voltar para o README](../README.md)

---

## 1. O que ele pediu, e o corte que define tudo

Um sistema de **personalização visual e colecionáveis**: molduras de perfil,
figurinhas e itens desbloqueáveis.

Nas palavras dele:

> *"Não quero copiar o modelo de assinatura premium do Discord. A proposta é
> explorar maneiras de oferecer aos usuários mais liberdade de personalização,
> expressão e identidade dentro do GamerHub."*

**Sem loja, sem pagamento, sem economia virtual** como requisito inicial.

E a restrição da fase, que ele escreveu em maiúsculas:

> *"Neste momento, NÃO quero implementar nenhuma funcionalidade… Trate isso
> como uma investigação de arquitetura e produto, não como uma tarefa de
> programação."*

**Enquanto esta fase durar, a única escrita permitida é documental.** Nada de
código, migration, RLS, bucket, dependência, commit do estudo no GitHub.

---

## 2. O contexto mínimo do GamerHub

React 19 + Vite + Tailwind 4 + Framer Motion · Supabase (Postgres 17) ·
Vercel. Cliente usa **só a anon key** — a segurança real mora no RLS e nas
funções `SECURITY DEFINER`.

As regras de trabalho estão no `CLAUDE.md` e nos `docs/regras/`. As que mais
pesam neste assunto:

| regra | por que importa aqui |
| --- | --- |
| §1.3 | validação no cliente não vale nada: o site usa a `anon key` |
| §0.2 | *"quantas vezes por dia isso roda?"* antes de ligar qualquer coisa |
| §0.3 | orçamento de bytes — **230 KB gzip** no carregamento inicial |
| §4 | fonte única; fallback silencioso é proibido |
| §1.1 | fato ≠ inferência ≠ hipótese, e cada um se escreve diferente |

---

## 3. O que JÁ foi apurado — não refaça

Tudo abaixo foi verificado em **09/10/2026**, abrindo o arquivo ou consultando
o banco. O detalhe e a evidência estão no documento de planejamento.

| achado | onde |
| --- | --- |
| o avatar é **um** componente de 33 linhas, com 16 usos e 5 tamanhos | §2.1 |
| a borda de rank é **CSS na mesma caixa**, e há `overflow:hidden` | §2.2 |
| **as conquistas NÃO têm tabela** — são derivadas, e isso impede desbloqueio permanente sem persistência nova | §2.3 |
| `authenticated` tem `UPDATE` em **12 colunas nominais** de `profiles` | §2.4 |
| dois buckets, ambos públicos; egress de **5 GB/mês** é o teto que morde | §2.5 |
| **bug achado** na busca (`<Avatar url=… username=…>` contra um componente que só aceita `profile`) — **corrigido em 09/10**, com trava de classe | §2.6 |
| Rive canvas-lite = **222 KB** comprimido, contra um orçamento total de 230 KB | §3.2 |
| OpenMoji é **CC BY-SA 4.0**: derivado obriga a mesma licença | §3.3 |
| `lucide-react` é **ISC**, `react-icons` é **MIT** | §3.3 |

**A conclusão estrutural, em uma frase:** o avatar é fácil de mexer, o
inventário precisa de tabelas próprias, e `profiles` está fora de questão
porque privilégio de coluna não expressa *"só o que você possui"*.

---

## 4. O que FALTA pesquisar

1. **A licença do Twemoji**, no repositório oficial — as fontes encontradas
   eram agregadores. O projeto foi arquivado pelo X e há forks comunitários.
2. **Os limites de armazenamento** do plano Free do Supabase, na documentação
   oficial. O egress (5 GB/mês) está medido; o tamanho do bucket não.
3. **Teste visual da moldura em 24 px** — se as duas camadas (rank + moldura)
   são legíveis nesse tamanho, ou se a moldura precisa de um mínimo.
4. **Quanto pesa, medido**, uma coleção de 10 molduras em SVG inline contra a
   mesma em WebP. O estudo estima; ninguém mediu.

---

## 5. As decisões que esperam ELE

Nenhuma implementação deve começar antes destas:

1. ~~**Desbloqueio permanente ou condicional?**~~ **✅ decidida em 10/10:** por
   conquista — `permanente: true` nas de EVENTO, `false` em `perfil_completo`,
   que é ESTADO. Já no ar, com trava. Ver `DECISOES.md`.
   **O que ela deixou aberto, para quando a conquista destravar item:**
   moderação ocultar o conteúdo deve revogar a moldura?
2. **Aceita que figurinha derivada de OpenMoji torne a coleção CC BY-SA?**
3. **Coleção nova exigindo deploy é aceitável agora?**
4. **Onde as figurinhas entram primeiro?** (recomendação: chat da live)
5. **Moldura aparece em avatar de 24 px?**

> **`[09/10]` A 6ª decisão saiu da lista porque foi tomada:** *"o bug da busca
> vira item do backlog?"* — ele respondeu **consertar**, e a correção já está
> na `main` com trava (§2.6). Ela fica registrada aqui para não ser reaberta.

---

## 6. O prompt para retomar

Cole isto numa sessão nova. Ele pressupõe que os dois documentos existem.

```
Vamos retomar o estudo de cosméticos do GamerHub.

Leia docs/PLANEJAMENTO-COSMETICOS.md e docs/PROMPT-CONTINUIDADE-COSMETICOS.md
ANTES de qualquer coisa. Eles guardam o que já foi apurado em 09/10/2026, com
a origem de cada afirmação marcada ([CÓDIGO], [OFICIAL], [RECOMENDAÇÃO],
[HIPÓTESE], [DECISÃO PENDENTE]).

Regras desta retomada:

- NÃO refaça o que está marcado [CÓDIGO] — a menos que suspeite que
  envelheceu. Nesse caso, confira contra o sistema e CORRIJA o documento
  dizendo o que mudou (§1.4: documento envelhece, o sistema não mente).
- O que está marcado [HIPÓTESE] ou listado na seção "o que falta pesquisar"
  é o trabalho de verdade.
- Continua valendo a restrição da fase, se eu não tiver dito o contrário:
  investigação e documentação, nenhuma alteração executável.

Me diga primeiro:
1. o que no documento você conferiu e continua verdade;
2. o que envelheceu;
3. qual das decisões pendentes bloqueia mais coisa.

Depois siga de onde parou.
```

---

## 7. Se eu já tiver decidido e a fase mudar

Quando ele aprovar e a implementação começar, a sequência recomendada está no
§6 do planejamento, e a Fase 1 é deliberadamente pequena: **2 ou 3 molduras em
CSS/SVG, concedidas a todo mundo, sem regra de desbloqueio**.

O motivo está escrito lá e vale repetir aqui, porque é a parte que se perde
primeiro: isso separa *"o sistema funciona"* de *"a regra de ganhar está
certa"*. Entrando juntas, uma moldura que não aparece tem dois suspeitos.

E o critério de pronto da Fase 1 não é visual:

> a pessoa escolhe, recarrega, continua escolhida — **e** um `PATCH` direto na
> REST API tentando equipar o que ela não tem **falha**.

---

## 8. Estado deste estudo

**Pesquisa concluída em 09/10/2026. Nenhuma implementação realizada.**

Os dois documentos foram gravados no repositório de trabalho. Nenhum arquivo
executável foi alterado.
