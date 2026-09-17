# `[17/09]` Os dois prompts do dono — texto integral

> **Por que este arquivo existe.** Ele mandou dois briefings longos e disse:
> *"quero que vc grave tudo e faça tudo em paralelo ao que já estamos fazendo"*.
> O `BACKLOG.md` guarda **o que vira trabalho**; este arquivo guarda **o texto
> dele**, para que a intenção original não dependa da conversa nem do meu
> resumo. Quando eu e ele discordarmos sobre o que foi pedido, ganha o que está
> aqui.
>
> Como todo `db/AAAA-MM-DD-*.md`, este é **retrato de um dia**: ele registra o
> pedido, não o estado do sistema.

---

## PROMPT 1 — Auditoria técnica pós-landing

**Contexto dado por ele:** a landing já é considerada finalizada em direção
visual, identidade, narrativa, composição, animações e experiência. *"Esta
tarefa NÃO é uma nova rodada de redesign."* É auditoria técnica guiada pelo
PageSpeed/Lighthouse.

### O escopo é o GamerHub inteiro, com pesos diferentes por área

| Área | O que priorizar | O que NÃO fazer |
| --- | --- | --- |
| **Landing** | defeito técnico real | alteração visual ou estrutural para melhorar métrica |
| **Públicas / institucionais** (`/sobre`) | SEO, títulos, meta description, canonical, structured data, acessibilidade, crawling, console | — |
| **Autenticação** | funcionamento, erros de JS, acessibilidade, navegação, segurança | tratar como página que precisa ser indexada |
| **Aplicação logada** (feed, mural, perfis, lives, chat, keys, ranks, notificações, configurações) | bug real, console, request que falha, carregamento, acessibilidade, responsividade, segurança | aplicar regra de SEO de página pública |
| **Administrativa** | segurança, autorização, exposição indevida, console | indexar; expor rota no sitemap; usar `robots.txt` como segurança |
| **Legais** | legibilidade, acessibilidade, estrutura, SEO básico | transformar em experiência cinematográfica |

**A pergunta antes de qualquer alteração:** *"Qual é a finalidade desta
página?"* — e só então aplicar o que faz sentido para aquela finalidade.
*"Não faça mudanças globais apenas porque uma recomendação apareceu no
Lighthouse."*

### A regra principal, na letra dele

> *"NÃO quero uma caça ao 100/100. O objetivo NÃO é fazer o Lighthouse mostrar
> 100 a qualquer custo."*

Performance só se toca com: **(1)** problema real identificado, **(2)**
evidência de ganho real, **(3)** ganho relevante, **(4)** sem prejuízo visual ou
funcional, **(5)** sem prejudicar a landing, **(6)** sem regressão, **(7)**
validável antes/depois.

- ganho pequeno, incerto ou teórico → **não implementa**
- pode prejudicar a landing → **não implementa**
- performance já boa e sem ganho claro → **não mexe**

### As camadas, na ordem obrigatória

1. 🔴 **Console** — achar a **causa** de cada erro. Proibido: remover
   `console.error` para calar o Lighthouse, esconder erro, silenciar warning,
   `try/catch` artificial, mascarar sintoma. *(O projeto já usa Sentry; não
   adicionar outro monitoramento.)*
2. 🟠 **`robots.txt`** — verificar o que está **servido em produção**, não só o
   repo. Permitir crawl das públicas, apontar o sitemap com URL absoluta, não
   usar como segurança.
3. 🟠 **`sitemap.xml`** — só URLs públicas e indexáveis. *"Não invente URLs."*
   Sitemap pequeno está ok.
4. 🟡 **SEO estrutural** — `<title>` descritivo e único, meta description
   coerente, canonical quando fizer sentido. *"Não introduza uma biblioteca de
   SEO apenas para isso se não houver necessidade."*
5. 🟡 **Structured data (JSON-LD)** — `WebSite`, e `Organization` se fizer
   sentido. *"NÃO invente dados estruturados"*: sem avaliação falsa, preço
   inexistente, link falso. Sem dado suficiente → não implementa.
6. 🟢 **Acessibilidade** — contraste, `alt`, nome acessível, foco, headings,
   ARIA, teclado. *"Não altere a identidade visual só porque uma regra
   automática sugere algo que prejudicaria a direção artística."*
7. 🔵 **Performance** — deliberadamente restritiva (ver acima).
8. ⚪ **`llms.txt`** — convenção emergente, versão simples e pequena. Não é
   substituto de SEO nem de robots, não é segurança, não é fator de ranking.

### Modo de execução

Etapa 1 (console · robots · sitemap · llms) → apresentar **diagnóstico em
tabela** → implementar só o necessário → validar. Só então Etapa 2 (SEO), Etapa
3 (JSON-LD + acessibilidade), Etapa 4 (performance, com auditoria escrita antes
de tocar em qualquer coisa).

Validação obrigatória a cada camada: lint · testes · build · rotas afetadas ·
landing · mobile · desktop · console · antes/depois quando houver métrica.

### Proibições dele, resumidas

Redesenhar a landing · alterar identidade · substituir artes · remover cenas ·
simplificar animações · remover Framer Motion · trocar arquitetura ou biblioteca
sem necessidade · refatoração geral · alterar Supabase, autenticação ou
funcionalidade sem necessidade · mudar "porque seria melhor" sem evidência ·
perseguir nota · silenciar console · SEO fake · structured data inventado · URL
inventada · complexidade desnecessária.

### O princípio de engenharia, na letra

> *"O PageSpeed/Lighthouse é uma ferramenta de diagnóstico. Ele NÃO é o produto.
> O usuário final é o produto."*
>
> *"Se uma mudança melhora uma métrica mas piora a experiência, não faça. Se
> melhora tecnicamente sem alterar a qualidade, faça. Se não houver ganho real,
> não mexa."*

E o fecho: *"Este trabalho termina quando os problemas reais estiverem
resolvidos. Não transforme uma auditoria técnica em uma refatoração infinita."*

**A ressalva final dele:** *"a Landing Page está finalizada. Trate-a como uma
área protegida durante esta auditoria, contudo ainda temos que polir algumas
coisas caso eu peça, ok?"* — ou seja, a proteção vale contra **iniciativa
minha**, não contra pedido dele.

---

## PROMPT 2 — A evolução visual FUTURA da landing

**A ordem que abre e fecha o pedido:** registrar uma decisão estratégica para
uma evolução futura. **NÃO implementar agora** — não alterar a landing, não
substituir imagem, não criar SVG, não gerar asset, não instalar dependência,
não refatorar componente, não mexer em código por causa disto.

### O princípio central

> **uma experiência = uma cena** — e **não** *uma feature = uma cena*.

Funcionalidade nova não gera cena nova automaticamente. A landing cresce por
**pilares narrativos**, não por catálogo. Agrupamentos conceituais que ele deu
como exemplo (não como especificação): HUB/DESCOBERTA · ENCONTRE SUA GENTE ·
ACONTECE AGORA · DESCUBRA/OPORTUNIDADES · PROGRESSÃO/PERTENCIMENTO.

A pergunta ao surgir funcionalidade nova: *"Essa funcionalidade pertence a uma
experiência que já existe na narrativa?"* Se sim, **enriquecer a cena
existente**.

### O problema futuro dos assets

Imagem feita para representar uma tela específica envelhece junto com a tela.
Ele antecipa: excesso visual, perda de clareza, asset difícil de manter,
dependência da aparência atual da UI, recriação constante, inconsistência entre
produto e landing.

Saída possível no futuro: **sistema visual híbrido** — imagem conceitual · SVG ·
CSS · componentes inspirados na UI real · composição híbrida. Decisão **cena por
cena**. *"SVG não deve ser utilizado simplesmente porque parece tecnológico."*

### Atemporalidade — a regra mais importante

> **Preservar o conceito, não necessariamente o asset.**

Evitar arte que dependa de: texto da interface, preço, número de usuários, nome
temporário de componente, botão, layout, posição exata, funcionalidade que pode
sumir, aparência momentânea de uma tela.

Priorizar o que é permanente: conexão · comunidade · descoberta · pertencimento
· progressão · competição · interação · oportunidade.

A pergunta certa: *"o que essa experiência significa dentro do GamerHub?"* — e
não *"como essa tela está implementada hoje?"*

### Duas camadas

**Narrativa** (o que o GamerHub significa): arte, composição, metáfora,
identidade, atmosfera. **Factual** (como a experiência existe hoje): UI real,
componentes, SVG, CSS, demonstração. A landing pode combinar as duas — é o que
permite a identidade ficar estável enquanto o produto evolui.

### Permissão futura, quando ativada

Remover, substituir e reorganizar assets **está autorizado** quando a estratégia
for ativada. *"Uma imagem NÃO deve ser preservada simplesmente porque já
existe."* Mas a substituição preserva a **intenção narrativa** da cena.

A pergunta não é *"como manter essa imagem?"* — é *"qual ideia essa imagem
deveria comunicar, e qual é a melhor representação dessa ideia agora?"*

### Critério de ativação

Não é número de funcionalidades. É: **a representação atual deixou de escalar?**
Sinais: dificuldade de representar experiência nova sem criar cena, asset
ficando obsoleto rápido, recriação constante, perda de clareza narrativa,
experiência importante que não cabe numa imagem.

### Processo obrigatório quando for ativada

Auditoria → mapeamento de funcionalidades em experiências → estratégia visual
por cena → **proposta antes de mexer em código** → definição de assets (com
briefing de geração específico, para ele aprovar) → só então implementação.

### A regra de ouro, na letra dele

> *"Não construir uma landing maior apenas porque o produto ficou maior.
> Construir uma narrativa melhor capaz de representar um produto maior."*
>
> *"Uma experiência = uma cena. Preservar a ideia, não o asset. Representar o
> conceito, não congelar a implementação."*

### Status

**FUTURO / NÃO IMPLEMENTAR AGORA.** A existência do documento **não** autoriza
alterar a landing. Implementação futura só por decisão explícita dele.
