# GamerHub como app Android — auditoria técnica (Fase 0)

> **Isto é investigação e planejamento. Nada foi implementado.** Nenhum arquivo
> de `src/` foi alterado por causa deste documento, nenhuma dependência foi
> instalada, nenhum projeto Android foi criado, e o banco não foi tocado — o
> regime foi pedido assim pelo dono em 08/10.
>
> A pergunta que ele fez, na letra: *"A arquitetura atual do GamerHub permite
> transformá-lo em um aplicativo Android instalável de verdade (APK), mantendo a
> maior parte possível da aplicação atual, e qual seria o caminho técnico mais
> adequado para isso?"*

---

## 1. Veredito

**Sim, e com pouco retrato.** A arquitetura atual é favorável de um jeito que não
era garantido: o site é uma SPA que conversa com o backend **só por HTTPS e
WSS**, sem nada que dependa do servidor que serve o HTML. Isso é o que decide a
resposta — não o fato de ser React.

**Três coisas precisam mudar, e nenhuma delas é o site.** Estão na seção 6, e a
mais importante é a de autenticação por link de email.

**O que eu NÃO posso afirmar:** que o app vai funcionar. Nada foi construído, e
este documento é leitura de código, não medição de um APK rodando. A primeira
coisa da Fase 1 é justamente produzir o APK e **medir**.

---

## 2. A arquitetura encontrada

| | |
| --- | --- |
| frontend | React 19 + Vite, SPA com `BrowserRouter` |
| build | `vite build` → `dist/` (6,0 MB com fontes e imagens; **760 kB bruto / 229 kB gzip** no carregamento inicial, com teto no CI) |
| estado do servidor | `@tanstack/react-query` |
| backend | Supabase — Postgres, Auth, Realtime, Storage, 10 Edge Functions |
| hospedagem | Vercel, SPA com rewrite para `/` |
| dependências de runtime | 12, e **nenhuma delas é específica de navegador** além das óbvias de DOM |

**O ponto que mais importa, e foi medido:** as únicas coisas que o app precisa do
mundo externo são `https://<projeto>.supabase.co` e `wss://…` para o realtime.
Não há API própria, não há servidor de sessão, não há cookie.

### O que o código realmente usa do navegador

Varredura por API, não por impressão — 25 APIs procuradas, estas existem:

| API | Onde | Dentro de um WebView |
| --- | --- | --- |
| `localStorage` · `sessionStorage` | 15 e 13 arquivos (sessão do Supabase, preferências, marca de entrada) | **funciona igual**, e persiste entre aberturas |
| `IntersectionObserver` · `ResizeObserver` | 6 e 4 arquivos (`LazyVisible`, layout) | funciona |
| `createObjectURL` | 8 arquivos (prévia de mídia antes do upload) | funciona |
| `getUserMedia({ audio: true })` | `components/ui/AudioRecorder.jsx` | **pede permissão nativa** — ver 6.3 |
| `navigator.clipboard` | `pages/Keys.jsx` | funciona |
| `<input type="file">` | 4 arquivos | funciona, mas o WebView precisa de um seletor ligado (o Capacitor liga) |
| `matchMedia` · `navigator.onLine` · `visibilitychange` | preferências, saúde do banco | funciona |
| `requestIdleCallback` | 1 arquivo | funciona |

**E o que NÃO existe, o que é tão importante quanto:** nenhum uso da
`Notification` do navegador (as 6 ocorrências de "Notification" são o conceito
do próprio site, na tabela `notifications`), nenhum `document.cookie` fora de um
fixture de teste de XSS, nenhuma geolocalização, nenhum `getDisplayMedia`,
nenhum service worker.

### PWA: metade existe, e a metade que falta é a que decide uma abordagem

- ✅ `public/manifest.webmanifest` **completo para instalação**: `display:
  standalone`, `start_url`, cores de tema e os três ícones (192, 512 e
  **maskable** 512). O `index.html` o referencia.
- ❌ **Nenhum service worker.** `grep` por `pwa`, `workbox`, `serviceWorker` e
  `registerSW` em `package.json` e `vite.config.js` não devolve nada.

Então *"já é PWA"* é falso e *"não dá para ser"* também: é uma lacuna conhecida.

---

## 3. As abordagens avaliadas

| | Abordagem | Veredito |
| --- | --- | --- |
| 🥇 | **Capacitor** | **recomendada** — ver seção 4 |
| | **PWA / TWA** | mais barata, e **a primeira coisa a medir**. Ver 3.1 |
| | WebView nativo escrito à mão | faz o que o Capacitor faz, com o trabalho de manutenção do zero: seletor de arquivo, permissão de microfone, botão voltar, cookies de terceiro. Não há ganho |
| | **React Native** | reescreve **toda** a camada de tela. `framer-motion`, Tailwind e cada componente teriam equivalente novo. O backend sobreviveria; o site, não |
| | **Expo** | o mesmo do React Native, com esteira melhor. Mesmo retrato |
| | reescrita nativa (Kotlin) | o dono já excluiu, e com razão: dois produtos para manter |

### 3.1 Por que PWA/TWA merece ser medido ANTES

Se o objetivo é *"instalar no meu celular e testar"*, pode ser que **nenhum APK
seja necessário**: o Chrome no Android instala um site com manifest como app, e
o ícone fica na gaveta como qualquer outro.

**O que eu não sei, e é a 1ª verificação da Fase 1:** se o Chrome atual exige
service worker para oferecer "Instalar app". Essa regra mudou de versão para
versão, e eu me recuso a afirmar de memória. É uma verificação de minutos e pode
encurtar o caminho inteiro.

**O que o PWA não dá**, e é por isso que ele não encerra a questão: não é um APK
(não se instala por arquivo, não se publica em loja), e não alcança recurso
nativo — que é a seção 10.

---

## 4. A abordagem recomendada: Capacitor

**Porque ele não pede retrato.** O Capacitor pega o `dist/` que o `vite build`
já produz e o embrulha num projeto Android. O `src/` inteiro continua sendo o
mesmo arquivo para web e para Android — **não existe versão "mobile" do código**.

**E porque a arquitetura já é a que ele exige:** app que fala com o backend só
por HTTPS/WSS, sem servidor próprio. Um site que dependesse de rota de servidor,
de cookie de sessão ou de renderização no servidor precisaria de obra antes; este
não precisa.

### O que apareceria no repositório

```
android/                  ← projeto Gradle, versionado
  app/src/main/
    AndroidManifest.xml   ← permissões (microfone), App Links
    assets/public/        ← o `dist/` copiado pelo `npx cap sync`
  build.gradle
capacitor.config.json     ← id do app, nome, servidor
package.json              ← + @capacitor/core, /cli, /android
```

### A arquitetura, ajustada ao que foi medido

```
                      src/  (UM código)
                          │
                    vite build → dist/
                          │
            ┌─────────────┴─────────────┐
          Vercel                   npx cap sync
         (web)                          │
            │                      android/ (Gradle)
            │                           │
            │                        APK  →  celular
            └─────────────┬─────────────┘
                          │
                  Supabase  (o MESMO)
           Postgres · Auth · Realtime · Storage · Edge
```

---

## 5. Impacto no frontend

**Quase nenhum, e isso foi conferido arquivo a arquivo.** O que muda:

| | |
| --- | --- |
| `BrowserRouter` | **continua** — o Capacitor serve de `http://localhost` com history API |
| `localStorage` | **continua** e persiste; a sessão do Supabase sobrevive a fechar o app |
| `window.location.origin` | **muda de valor** — ver 6.1, é o único ponto do `src/` que isto afeta |
| botão voltar do Android | **`[08/10]` correção:** eu escrevi "não existe tratamento" e estava errado. A ponte nativa que vem dentro do pacote `@capacitor/android` documenta uma **ação padrão**, desligada só quando alguém registra um ouvinte pelo plugin `App`. O comportamento exato mora na biblioteca compilada — continua a MEDIR no aparelho, mas é "existe padrão e é substituível", não "não existe nada" |
| `safe area` / notch | o site é responsivo e já roda bem no celular, mas em tela cheia nativa a barra de status pode sobrepor — medir no primeiro APK |
| teclado virtual | já é o do Android hoje, pelo navegador |

---

## 6. Impacto no Supabase — a resposta direta

> **O backend pode continuar exatamente o mesmo?**
> **Quase. Três coisas mudam, e nenhuma é no banco.**

Postgres, RLS, as 77 funções `SECURITY DEFINER`, Realtime, Storage, os buckets
`avatars` e `post-media`, e as 4 Edge Functions chamadas do cliente
(`radar-de-pautas`, `redigir-materia`, `responder-contato`, `verify-contact`)
**continuam idênticos**. Nada neles conhece o domínio de quem chama.

### 6.1 🔴 O link de email é o problema de verdade

Dois lugares:

```js
// src/pages/Login.jsx:85
redirectTo: window.location.origin + '/auth/confirm'
```
```ts
// supabase/functions/send-email/index.ts:76
const APP_URL = "https://gamerhub-nine.vercel.app";
```

No app, `window.location.origin` passa a ser `http://localhost` — um endereço
que o Supabase vai recusar se não estiver na lista, e que **não abre o app** a
partir de um email de qualquer jeito.

**A saída é App Links:** o domínio do site passa a abrir o app no Android, e o
link de confirmação continua sendo um só, para os dois. Exige um arquivo
`assetlinks.json` no domínio e a declaração no `AndroidManifest.xml`.

**Por que isto é 🔴 e não 🟡:** `hooks/useAuth.jsx` e `pages/Login.jsx` estão na
lista de **alto risco** do `CLAUDE.md` §7. Mexer ali sem teste dos dois lados já
derrubou o site antes.

### 6.2 🟠 Os cabeçalhos de segurança SOMEM, e nenhuma trava percebe

Hoje a CSP, o `X-Frame-Options`, o `Referrer-Policy` e o `Permissions-Policy`
vêm do **`vercel.json`** — ou seja, do servidor. O Capacitor serve o app
localmente: **nenhum deles se aplica**.

E o `e2e/portas-da-web.mjs`, que compara esses cabeçalhos **por valor** e reprova
o PR se um enfraquecer, bate no site. Ele continuaria verde com o app
desprotegido — a "cobertura que não cobre" do §1.5, aplicada à própria esteira.

**A saída** é replicar a política numa `<meta http-equiv>`, com trava que exija
as duas metades iguais. **Foi tentado em 08/10 e teve de ser retirado**, por
duas razões que só apareceram ao medir:

1. **`frame-ancestors` é ignorado em `<meta>`** (CSP Level 3) e o Chrome escreve
   um `console.error` por página. O `e2e/smoke.mjs` trata isso como falha:
   **18 de 18 rotas** caíram por um aviso que não era defeito. Contornável —
   basta a meta não carregar as diretivas que só valem em cabeçalho.
2. **O que NÃO é contornável sozinho:** com a política aplicada localmente, a
   rota `/contato` falhou porque a CSP bloqueia o Turnstile. Isso revelou um
   **defeito de produção** (ver abaixo), e a correção depende de uma decisão
   de segurança do dono.

### 6.2.1 🟠 `[08/10]` E isso DESENTERROU um defeito de produção

Ao aplicar a política localmente, `/contato` parou de funcionar:

```
Refused to load the script 'https://challenges.cloudflare.com/turnstile/v0/api.js'
because it violates the following Content Security Policy directive
```

**Conferido no site no ar**, não deduzido: a CSP de produção tem
`script-src 'self'` e um `frame-src` sem a Cloudflare. **O Turnstile do
formulário de contato está bloqueado** — o script nunca carrega e a tela cai no
teto de 12 s de `lib/turnstile.js`, que existe justamente para a espera não ser
infinita. Ou seja: ele falha com elegância, e por isso ninguém notou.

**Por que isso nunca apareceu:** a política do `vercel.json` só é aplicada pela
Vercel, em produção. O `vite preview` local não manda cabeçalho nenhum, e o
`e2e/politica-de-conteudo.mjs`, que sobe o `dist` COM a política, carrega 6
rotas — `/contato` não é uma delas.

**Por que eu não consertei:** `script-src` é travado por IGUALDADE em
`e2e/portas-da-web.mjs`, e de propósito — o comentário de lá diz que
`connect-src` e `frame-src` crescem com serviço novo, mas afrouxar `script-src`
é **sempre** decisão de segurança. Autorizar `challenges.cloudflare.com` a
executar script no site é exatamente essa decisão, e ela é do dono.

**E há um efeito de processo que vale registrar:** aquele portão bate na
PRODUÇÃO. Qualquer mudança numa diretiva travada reprova o próprio PR que a
faz, porque a produção ainda serve a política antiga. O portão antecipou isso
para as diretivas que crescem e não para as travadas — é um impasse real, e
está no `BACKLOG.md`.

### 6.3 🟡 O microfone passa a pedir permissão nativa

`AudioRecorder.jsx` usa `getUserMedia({ audio: true })`. Num WebView isso exige
`<uses-permission android:name="android.permission.RECORD_AUDIO">` **e** o
tratamento do pedido pelo lado nativo. O Capacitor faz a segunda parte; a
primeira é uma linha no manifesto.

---

## 7. Impacto no GitHub e no build

O que existe hoje continua intocado:

```
GitHub → Vite → dist/ → Vercel        (o site, como é hoje)
```

O que se acrescenta, **sem tirar nada**:

```
GitHub → Vite → dist/ → npx cap sync → android/ → Gradle → APK
```

**O `npm run build` não muda.** O `cap sync` é um passo a mais que copia `dist/`
para dentro de `android/` — não um build diferente.

**O que NÃO entra no CI agora**, e é decisão deliberada: construir APK no GitHub
Actions custaria minutos e produziria um artefato que ninguém instala ainda.
Enquanto o objetivo for *"testar no meu aparelho"*, o APK é construído à mão.

---

## 8. Celular × PC — a tabela

Esta é a seção que o dono marcou como a mais importante. Os veredictos sobre
Termux vêm de pesquisa feita em 08/10, **não de memória** — e nenhuma fonte é
documentação oficial do Google ou do Termux, o que por si só é um dado.

| Etapa | 📱 Celular | Por quê |
| --- | --- | --- |
| 1. Auditar o projeto | 🟢 | é leitura; GitHub no navegador basta |
| 2. Alterar código | 🟢 | editar e commitar pelo GitHub web |
| 3. Instalar dependências (`npm i`) | 🟢 | Node roda nativo no Termux |
| 4. `vite build` | 🟢 | é só Node |
| 5. Instalar o Capacitor | 🟢 | são pacotes npm |
| 6. `npx cap add android` | 🟢 | gera arquivos, não compila |
| 7. Instalar o **Android SDK** | 🟡 | existe caminho em Termux, de terceiros |
| 8. **Rodar o Gradle** | 🔴🟡 | **é aqui que trava** — ver 8.1 |
| 9. Gerar o APK | 🟡 | só depois de resolver o 8 |
| 10. Assinar o APK | 🟢 | `keytool`/`apksigner` rodam em ARM |
| 11. Instalar no próprio aparelho | 🟢 | abrir o APK e permitir "fontes desconhecidas" |
| 12. Testar | 🟢 | é usar o app |
| 13. Depurar | 🟡 | sem `chrome://inspect` de um PC, sobra log na tela |

> ### ✅ `[08/10]` E A RESPOSTA MUDOU no mesmo dia — o PC não é necessário
>
> Esta seção foi escrita pensando no aparelho dele. **O ambiente onde eu rodo é
> outro:** Linux **x86-64**, JDK 21, 27 GB livres. O bloqueio do `aapt2`
> compilado para x86-64 — que é o que trava no celular — **não existe aqui**.
>
> O SDK foi instalado (462 MB: plataforma 36 e build-tools 36) e o APK é
> construído neste container e entregue como arquivo. Ele só instala.
>
> **A seção abaixo continua valendo**, e de propósito: ela é a resposta para
> *"e se eu quiser construir no meu celular?"*, que é uma pergunta diferente de
> *"como eu tenho um APK?"*. Confundir as duas foi o que me fez escrever a
> tabela inteira apontando para um PC que não era preciso.

### 8.1 O ponto exato onde o PC entra, e não é o que parece

**Não é o Android Studio.** O obstáculo é concreto e tem nome:

> O Gradle baixa do Maven do Google um **`aapt2` compilado para x86-64**, e um
> celular ARM **não consegue executá-lo**.

O contorno existe — `android.aapt2FromMavenOverride` apontando para um `aapt2`
ARM64 — e há projetos de terceiros que empacotam build-tools aarch64. Mas:

- são **projetos da comunidade**, não distribuição oficial;
- as versões precisam ser fixadas (Java, Gradle, `compileSdk`), e guias antigos
  usam `compileSdk 31` ou 34, que podem não casar com o que o Capacitor gera;
- o aparelho precisa de ~1 GB livre.

**A resposta honesta:** dá para fazer no celular, e **é a etapa onde um PC
economiza horas**. Para a primeira vez, um PC transforma "um fim de semana
lutando com toolchain" em "dez minutos".

### 8.2 Android Studio × Android SDK — a distinção que ele pediu

| | É obrigatório? |
| --- | --- |
| **Android SDK / build-tools / platform-tools** | **sim** — é quem compila, empacota e assina |
| **Gradle** | sim (o Capacitor gera projeto Gradle) |
| **JDK** | sim |
| **Android Studio** | **não** — é a forma mais cômoda de instalar e administrar o SDK, e um editor. `sdkmanager` + `gradlew` pela linha de comando fazem tudo |

Em um PC sem Android Studio: `cmdline-tools` → `sdkmanager` instala o resto →
`./gradlew assembleDebug` produz o APK. Nenhuma tela é necessária.

---

## 9. Riscos e limitações — o que eu NÃO vendo

| | Risco |
| --- | --- |
| 🔴 | **Auth por link de email** (6.1). É o arquivo de alto risco do projeto |
| 🟠 | **Cabeçalhos de segurança somem** (6.2), e a trava existente não percebe |
| 🟠 | **Botão voltar do Android** sem tratamento fecha o app na primeira tela |
| 🟡 | **Microfone** pede permissão nativa (6.3) |
| 🟡 | **Tamanho do APK**: `dist/` tem 6,0 MB; com o runtime do Capacitor, a estimativa é **8–12 MB**. É estimativa, não medição |
| 🟡 | **Safe area / notch** em tela cheia nativa — só se vê medindo |
| 🟡 | **Toolchain ARM** (8.1) |
| 🔵 | **Dois lugares para o mesmo bug**: a partir daqui, um conserto de UI precisa ser visto nos dois |
| 🔵 | **Sem service worker, o app sem rede não abre nada** — hoje o site também não, mas num app isso parece defeito |

**O que NÃO é risco, e vale dizer:** Realtime, Presence, Storage, upload, RLS,
Edge Functions e as RPCs. Todos são HTTPS/WSS e não conhecem a origem de quem
chama — conferido, não suposto.

---

## 10. Recursos nativos no futuro

A escolha deixa espaço, e é um dos motivos dela:

| Recurso | Precisa de quê |
| --- | --- |
| notificação push | plugin + Firebase. **Hoje não existe nada disso no site** — seria recurso novo, não portado |
| deep links | já é exigência do 6.1; sai de graça |
| compartilhamento nativo | plugin oficial (`@capacitor/share`) |
| câmera / microfone | plugin + permissão. O microfone já é usado |
| haptics | plugin oficial |
| voz / salas de voz | WebRTC no WebView, com os mesmos custos já levantados em `COTAS.md` |
| **compartilhar tela** | `getDisplayMedia` **não existe em navegador de celular nenhum** (medido em 02/10) — num app nativo exigiria código nativo de captura |

---

## 11. Roadmap

| Fase | O que é | Termina quando |
| --- | --- | --- |
| **0** | Auditoria | ✅ este documento |
| **1** | **Medir o caminho curto**: o Chrome instala o site como app hoje? | a resposta está escrita, com print |
| **2** | Decisão dele: PWA basta, ou vamos de APK? | registrada em `DECISOES.md` |
| **3** | Capacitor no repositório, `android/` gerado | `npx cap sync` roda e o build não quebra |
| **4** | Auth e cabeçalhos (6.1 e 6.2) — **antes** do primeiro APK | App Links funcionando e a trava estendida |
| **5** | Primeiro APK | arquivo gerado, assinado em debug |
| **6** | Instalar e testar no aparelho dele | os fluxos do E2E passam à mão |
| **7** | Correções do que o aparelho mostrar | lista zerada |
| **8** | Recursos nativos | só se houver pedido |
| **9** | Play Store | fora de escopo hoje |

### Checklist de conclusão

- [ ] **F1** — o Chrome oferece "Instalar app" com o manifest atual? sim/não, com evidência
- [ ] **F3** — `android/` existe, `npm run build && npx cap sync` roda limpo
- [ ] **F3** — o site continua passando no CI inteiro
- [ ] **F4** — link de confirmação de email abre o APP, medido
- [ ] **F4** — CSP e cabeçalhos presentes no app, e a trava confere os DOIS
- [ ] **F4** — `RECORD_AUDIO` no manifesto e o gravador funcionando
- [ ] **F5** — APK gerado e assinado; **tamanho medido**, não estimado
- [ ] **F6** — entrar, publicar, comentar, curtir, upload, live e chat, no aparelho
- [ ] **F6** — botão voltar não fecha o app no meio da navegação
- [ ] **F7** — nada em `BACKLOG.md` marcado como bloqueador

---

## 12. Estado da jornada

```
GAMERHUB ANDROID — ESTADO DA JORNADA

Status:        FASE 3 EM EXECUÇÃO. Capacitor instalado, `android/` gerado,
                os três pré-requisitos (auth, CSP, microfone) FEITOS.
                APK em construção.
Objetivo:      APK instalável no aparelho dele, para teste pessoal.
                Play Store está fora de escopo.

Arquitetura escolhida:
  Capacitor — recomendada, NÃO decidida. Depende da Fase 1.

O que já foi verificado (lendo o código, não supondo):
  . 25 Web APIs procuradas; as que existem estão na seção 2
  . manifest.webmanifest EXISTE e está completo; service worker NÃO existe
  . `createClient` usa os padrões: sessão em localStorage, refresh automático
  . Realtime, Storage, Edge Functions e RPC não conhecem a origem de quem chama
  . `redirectTo: window.location.origin` e `APP_URL` fixo na `send-email`
  . cabeçalhos de segurança vêm do `vercel.json`, logo do servidor
  . `getUserMedia({audio:true})` em `AudioRecorder.jsx`
  . build: dist/ = 6,0 MB; inicial 760 kB bruto / 229 kB gzip
  . Termux: o bloqueio é o `aapt2` x86-64 baixado pelo Gradle

O que ainda precisa ser investigado:
  . o Chrome instala com manifest SEM service worker? (1ª tarefa da Fase 1)
  . tamanho real do APK
  . safe area / notch em tela cheia
  . comportamento do botão voltar

`[08/10]` O QUE JA FOI IMPLEMENTADO (ele aprovou e mandou seguir):
  . Capacitor 8.5.3; `android/` gerado (appId `app.gamerhub`)
  . `lib/dominio.js` — o endereco do site virou fonte unica, e o
    `resetPasswordForEmail` deixou de usar `window.location.origin`
  . CSP do app: TENTADA e RETIRADA deste bloco — ver 6.2, o motivo e o
    Turnstile
  . `RECORD_AUDIO` e `MODIFY_AUDIO_SETTINGS` no manifesto
  . `android` no `globalIgnores` do eslint (o bundle copiado dava 312 erros)
  . SDK Android instalado NESTE container (x86-64) — o PC deixou de ser
    necessario para gerar o APK

O que NAO foi alterado:
  . banco, RLS, Edge Functions, deploy da Vercel — nada disso foi tocado.

Próxima etapa:   Fase 1 — medir o caminho curto (PWA).
Pré-requisitos:  nenhum. É uma verificação de minutos.
Ponto atual:     esperando a decisão da Fase 2.

Última decisão tomada:
  nenhuma sobre Android. A recomendação é Capacitor, e ela espera a Fase 1.

Decisões ainda abertas:
  1. PWA basta, ou queremos APK de verdade?
  2. Se APK: App Links no domínio do site? (exige `assetlinks.json`)
  3. O app entra no CI, ou fica como build manual?
```

---

## 13. O que este documento NÃO responde

- **Se o app funciona.** Nada foi construído. Isto é leitura de código.
- **O tamanho do APK.** A estimativa de 8–12 MB é aritmética, não medição.
- **Se o Capacitor atual gera projeto compatível com o SDK que o Termux
  alcança.** Depende de versões que só se vê tentando.

**Sempre que uma destas for respondida, o número substitui a estimativa aqui** —
e a frase que foi substituída fica registrada, porque documento que só ganha
certezas esconde o que custou para chegar nelas.
