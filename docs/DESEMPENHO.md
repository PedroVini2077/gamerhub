# Desempenho — as medições, e onde elas mandaram mexer

> **O que é isto.** O histórico de investigação de desempenho do GamerHub: o que
> cada rodada de medição disse, o que ela desmentiu, e as duas vezes em que a
> conclusão apontou para o lugar errado. Saiu de
> [OPERACAO.md](OPERACAO.md) em 29/08, quando a seção passou de 150 linhas.
>
> **O que NÃO é.** O portão que reprova PR por peso continua em
> [OPERACAO.md](OPERACAO.md) — ele é operação, roda sozinho, e não depende de
> ninguém ler este arquivo. As decisões que saíram daqui estão em
> [DECISOES.md](DECISOES.md); o mapa de onde cada peça vive, em
> [ARQUITETURA.md](ARQUITETURA.md).
>
> **Por que guardar isto.** Duas vezes seguidas eu cheguei a um plano de
> otimização bem fundamentado e errado de alvo — uma por olhar byte quando o
> custo era CPU, outra por corrigir o caso "ninguém está vendo" e não medir o
> caso "está na tela". Nos dois casos, o que corrigiu o rumo foi uma MEDIÇÃO, e
> não um raciocínio melhor. É o que este arquivo existe para lembrar.

---

### `[28/08]` A medição de campo, e o que ela desmentiu

PageSpeed Insights, 28/08 às 19:19, Lighthouse 13.4.1:

| | Celular (Moto G Power emulado) | Computador |
| --- | --- | --- |
| **Desempenho** | **87** | **57** |
| First Contentful Paint | 2,9 s | 0,6 s |
| Largest Contentful Paint | 3,3 s | 1,2 s |
| **Total Blocking Time** | **0 ms** | **14.830 ms** |
| Cumulative Layout Shift | 0,012 | 0,003 |
| Speed Index | 2,9 s | 6,8 s |

Acessibilidade 98, Práticas 100, SEO 92 nos dois.

**No celular a rodada de otimização funcionou, e o número que prova é o TBT
zerado.** Em 27/08 ele estava em 3.690 ms (Termux) e 15.310 ms (PageSpeed); a
nota saiu de 36 para 87. O celular recebe a `Scene2D` e simplesmente não paga
os 887 KB.

**No desktop o resultado é ruim, e ele desmente uma frase que eu havia
escrito.** A documentação dizia que a cena 3D "não pesa no carregamento, porque
chega depois do ocioso". O TBT diz o contrário: chegar depois do ocioso adia o
trabalho, **não o elimina** — e a thread principal travada aparece no Speed
Index (6,8 s contra 1,2 s de LCP) e derruba a nota para 57.

> **Ressalva sobre o número, para ele não ser citado como exato depois.** A
> corrida de desktop rodou com **"Limitação personalizada"**, e não com o
> preset padrão (a de celular usou "Limitação lenta de 4G", esse sim padrão).
> Ou seja: os 14.830 ms **não são comparáveis** a uma corrida de desktop comum,
> e a magnitude está inflada por uma configuração que não sabemos qual é.
>
> O que a medição sustenta com segurança: no desktop a cena 3D custa **muito**
> trabalho de CPU depois da primeira pintura, e a diferença entre FCP/LCP
> ótimos e Speed Index de 6,8 s tem uma causa só. O que ela **não** sustenta é
> o valor absoluto. Repetir no preset padrão antes de usar esse número para
> decidir qualquer coisa (§0.3, regra 5: mesma ferramenta, mesmo aparelho,
> mesma configuração).

> A lição que fica: *"fora do caminho crítico"* e *"de graça"* não são a mesma
> coisa. O byte adiado continua sendo parseado e executado, e o orçamento de
> bytes — que mede o **carregamento inicial** — nunca ia enxergar isso. Ele
> continua certo no que mede; só não mede esta parte.

### `[28/08]` O perfil de CPU, e por que eu ia otimizar o lugar errado

A segunda corrida trouxe a repartição da thread principal no desktop — **30,7 s
no total** — e ela reescreve o diagnóstico:

| Categoria | Tempo |
| --- | --- |
| **Other** | **29.441 ms** |
| Script Evaluation | 789 ms |
| Style & Layout | 227 ms |
| Rendering | 133 ms |
| Script Parsing & Compilation | 79 ms |
| Garbage Collection | 28 ms |
| Parse HTML & CSS | 3 ms |

**96% do custo está em "Other"**, que num app WebGL é o `requestAnimationFrame`
— o laço de animação. Parsear, compilar e executar os 887 KB somam **menos de
900 ms**.

**A conclusão incomoda e é importante:** o plano que eu tinha (`createRoot` +
`extend` seletivo, −20% de bytes) mexeria nos 789 ms e deixaria os 29.441 ms
intactos. Eu ia otimizar com capricho a fatia errada. Foi por não ter esse
perfil que a hipótese do tamanho durou tanto — e é o §0.3 literal: **byte e CPU
são contas diferentes**.

**O desperdício de verdade:** a cena vive no Hero, no topo da página, e
continuava desenhando 60 vezes por segundo **depois que o visitante rolou para
longe dela**. Ninguém vê, e a CPU paga.

**A correção** é um `IntersectionObserver` que desliga o `frameloop` do
`<Canvas>` quando a cena sai da tela. Medido num navegador de verdade:

| | Desenhos em 2 s |
| --- | --- |
| Cena visível | 125 |
| Cena fora da tela | **0** |

Travado por `e2e/cena-3d.mjs`, que roda no CI e envolve `gl.drawElements` para
contar desenho de fato. Provado nos dois sentidos: com o `frameloop` fixo em
`always`, o teste falha acusando 140 desenhos fora da tela.

> **Por que não `frameloop="demand"`:** `demand` só desenha quando alguém pede
> um quadro, e esta cena é animada por natureza — ela congelaria justamente
> enquanto visível.

### `[29/08]` A correção acima estava CERTA e era metade — a metade menor

O dono repetiu o PageSpeed e o desktop continuou em 58, com 31,3 s de thread
principal e **30.182 ms em "Other"**. Praticamente o mesmo número de antes.

O erro do diagnóstico de 28/08 não foi a medição nem a correção: foi a
pergunta. Eu perguntei "por que a cena gasta CPU quando ninguém está vendo?" e
respondi bem. Nunca perguntei **quanto ela custa enquanto ESTÁ sendo vista** —
que é o caso em que o Lighthouse a observa, e o caso em que o visitante está
olhando para ela.

Medido em 29/08, navegador de verdade, `PerformanceObserver` de `longtask`,
janela de 8 s com o Hero na tela e build de produção:

| Configuração | Quadros | Long tasks | Thread bloqueada |
| --- | --- | --- | --- |
| `dpr [1, 1.5]` + `antialias` | 88 | 88 | **8.066 ms de 8.000 ms** |
| `dpr 1`, sem `antialias` | 133 | 132 | 7.897 ms |
| `dpr 0,75` | 182 | 9 | 468 ms |
| `dpr 0,5` | 243 | **0** | **0 ms** |
| resolução adaptativa (o que ficou) | 236 | 1 | **52 ms** |

**A thread principal ficava 99% ocupada**, e cada quadro isolado passava dos
50 ms que definem uma long task. Só cinco chamadas de desenho por quadro — o
custo não vinha de quantidade de objeto nem de bytes de JavaScript, e sim de
**PIXEL**. Foi por isso que nenhuma das otimizações de tamanho encostou nele.

Isso também explica a contradição entre os dois relatórios do dono: o do
**celular** trazia TBT **0 ms**, o do **desktop**, 31 s. Não era ruído de
medição — a cena não sobe abaixo de 1024px, então o celular nunca pagou por ela.

**A correção** é resolução adaptativa (`lib/resolucaoDaCena.js` +
`scene3d/ResolucaoAdaptativa.jsx`): a cena começa no `dpr` mais barato e sobe se
os quadros couberem em 60 fps. Não é um número fixo porque a medição acima é em
rasterização por software — o que Lighthouse e PageSpeed usam, e o que também
acontece em máquina com GPU bloqueada; numa máquina com GPU, cravar 0,5 puniria
quem não tem problema nenhum.

`e2e/cena-3d.mjs` passou a barrar bloqueio de thread acima de 800 ms, além de
continuar contando desenhos. Provado nos dois sentidos: **0 ms** com a correção,
**2.151 ms** com `dpr [1, 1.5]` e `antialias` de volta.

> **A lição que fica, e ela é de método:** "corrigi o caso A" não é o mesmo que
> "corrigi o problema". Quando o número não se move depois de uma correção
> medida e travada, o certo é procurar o caso que não foi medido — e não repetir
> a mesma medição esperando outro resultado (§1.2).

### O tamanho do chunk continua sendo outra conversa

`@react-three/fiber` v9.7.0 executa `extend(THREE)` dentro do próprio
`<Canvas>`, com o comentário no fonte dele: *"This will include the entire THREE
namespace by default"*. O namespace inteiro do `three` entra no bundle
independentemente do que a cena importa — e ela usa **cinco** símbolos
(`MathUtils`, `Vector3`, `Shape`, `ExtrudeGeometry`, `AdditiveBlending`).
Nenhum tree-shaking alcança isso enquanto o `<Canvas>` for usado. A saída
oficial está na mesma frase: *"users can extend their own elements by using the
createRoot API instead"*, e ela vale **−20%** (887 → 707 kB, medido).

Isso continua valendo a pena um dia, por causa do download em rede lenta. Mas
**não** era o que segurava a thread principal, e agora sabemos disso com
número.

> **Se ele reprovar seu PR:** a saída lista cada chunk com tamanho e diz o
> suspeito mais provável. Se o crescimento for intencional, suba o teto **no
> próprio script** e explique no commit por que o site precisou engordar — o
> limite existe para forçar essa frase.
