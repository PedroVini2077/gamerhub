# `[17/09]` PROMPT 1 · ETAPA 2 — title, description e canonical

## O diagnóstico

| Item | Estado medido | Problema? | Ação |
| --- | --- | --- | --- |
| `<title>` | **um só**, global, para as 6 públicas | 🟡 sim | por página |
| meta description | **uma só**, global | 🟡 sim | por página |
| `canonical` | **não existia** | 🟠 sim | criado |
| `og:` / `twitter:` | presentes, coerentes, com imagem 1200×630 | ✅ não | **não tocados** |

## O defeito: seis endereços que se anunciavam iguais

O site é uma aplicação de página única com `index.html` estático, e **navegação
do React Router não recarrega o documento**. Então `/sobre`, `/termos`,
`/privacidade`, `/regras` e `/contato` serviam todas:

```
<title>GamerHub — a comunidade gamer brasileira</title>
```

Para quem indexa, seis endereços que se anunciam igual **são a mesma página**.
Ele escolhe um e trata os outros como duplicata — quem procurasse "termos de uso
do GamerHub" podia cair na landing.

E não havia `canonical` nenhum: `?utm_source=…`, `?fbclid=…` e os domínios de
pré-visualização da Vercel viram endereços concorrentes do mesmo conteúdo.

## A solução, e por que NÃO entrou biblioteca

Pedido dele, na letra: *"não introduza uma biblioteca de SEO apenas para isso se
não houver necessidade"*.

`react-helmet-async` resolveria — e traria uma dependência, um provider no topo
da árvore e uma API nova, para fazer três `document.*` que o navegador já expõe.

O que entrou:

| Arquivo | O quê |
| --- | --- |
| `src/lib/metaDaPagina.js` | o catálogo das 6 públicas + `aplicarMeta()` |
| `src/components/ui/MetaDaRota.jsx` | aplica na troca de rota |
| `index.html` | `<link rel="canonical">` **base** |

O componente é **irmão do `RolagemDeRota`**, que já existia e resolve o mesmo
problema estrutural (navegação de SPA não é carregamento de documento). Seguir a
convenção da casa em vez de inventar uma segunda.

O catálogo mora em `lib/` e não no componente porque **o teste de contrato
precisa lê-lo sem montar React**.

## O LIMITE DISTO, escrito porque verde precisa significar algo

Isto roda **no navegador**, depois que o JavaScript executa.

| Quem lê | Enxerga o título por página? |
| --- | --- |
| Google | **sim** — renderiza JS, ainda que num segundo passe |
| rastreador que não executa JS | **não** — vê o `index.html` |
| WhatsApp, Discord, Twitter (cartão de link) | **não** |

Por isso o `og:` continua **estático** no `index.html`, e isso é decisão, não
esquecimento: raspador de cartão social não roda JavaScript. Um `og:title`
mexido no cliente nunca chegaria neles — só criaria a ilusão de que o cartão
muda por página. Resolver de verdade exigiria renderizar no servidor, que é
mudança de arquitetura e não ajuste de SEO.

## Validado em navegador de verdade

```
/             GamerHub — a comunidade gamer brasileira      /
/sobre        Sobre o GamerHub — quem fez e por que existe  /sobre
/contato      Falar com a equipe — GamerHub                 /contato
/regras       Regras da comunidade — GamerHub               /regras
/termos       Termos de uso — GamerHub                      /termos
/privacidade  Política de privacidade — GamerHub            /privacidade

títulos ÚNICOS entre as 6 públicas: 6 de 6
```

E o controle negativo: `/login` e `/keys` **continuam** com o título global e o
canonical da raiz — página atrás de login não deve se anunciar para quem indexa.

## A trava — `metaDaPagina.test.js`

Seis asserções. Três provadas reinjetando o bug:

| Bug reinjetado | A trava disse |
| --- | --- |
| rota pública nova (`/imprensa`) sem entrada | *"Rota publica SEM titulo e descricao proprios: /imprensa"* |
| dois títulos iguais | *"Titulo repetido entre paginas publicas"* |
| `<MetaDaRota />` desmontado do App | *"nao esta montado… e os outros testes deste arquivo continuariam VERDES"* |

A terceira é a que mais importa: é a falha que passa despercebida — catálogo
perfeito, todos os outros testes verdes, e ninguém aplicando nada.

## O que a Etapa 2 NÃO fez

JSON-LD e acessibilidade são a Etapa 3. Performance é a Etapa 4, e só com
evidência.
