/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        neon: {
          green: "#39ff14",
          purple: "#bf00ff",
          cyan: "#00ffff",
          pink: "#ff0090",
        },
        dark: {
          900: "#060608",
          800: "#0d0d12",
          700: "#13131a",
          600: "#1a1a24",
          500: "#22222e",
          400: "#2e2e3e",
        },
      },
      fontFamily: {
        display: ["'Orbitron'", "monospace"],
        body: ["'Rajdhani'", "sans-serif"],
        mono: ["'Share Tech Mono'", "monospace"],
      },
      boxShadow: {
        neon: "0 0 10px #39ff14, 0 0 30px #39ff1430",
        "neon-purple": "0 0 10px #bf00ff, 0 0 30px #bf00ff30",
        "neon-cyan": "0 0 10px #00ffff, 0 0 30px #00ffff30",
      },
      animation: {
        "pulse-neon": "pulseNeon 2s ease-in-out infinite",
        "slide-in": "slideIn 0.3s ease-out",
        "fade-up": "fadeUp 0.4s ease-out",
        scanline: "scanline 8s linear infinite",
        "electric-buzz": "electricBuzz 5s ease-in-out infinite",
        "electric-arc": "electricArc 4s ease-in-out infinite",
        // Cena leve do Hero (`landing/Scene2D.jsx`). São animações de CSS de
        // propósito: rodam no compositor e não disputam a main thread com o
        // resto do carregamento, que era exatamente o problema da cena 3D.
        "bolt-float": "boltFloat 7s ease-in-out infinite",
        "shape-drift": "shapeDrift 9s ease-in-out infinite",
        // `[10/09]` A cena nova da Landing (`landing/Scene2D.jsx`), construída
        // em volta da arte da identidade. Todas mexem SÓ em `transform` e
        // `opacity` — compositor, main thread livre, que é a propriedade que
        // separa esta cena da 3D de 887 kB.
        "anel-orbita": "anelOrbita 30s linear infinite",
        "nucleo-pulsa": "nucleoPulsa 4.5s ease-in-out infinite",
        "raio-respira": "raioRespira 9s ease-in-out infinite",
        "fragmento-flutua": "fragmentoFlutua 16s ease-in-out infinite",
        // Fundo da página "Sobre" (`sobre/FundoAnimado.jsx`). Atravessa a tela
        // devagar. Só `transform` e `opacity`: as duas rodam no compositor, e
        // é isso que separa "enfeite de graça" de "laço queimando CPU numa
        // página de LEITURA", onde a pessoa fica parada minutos.
        travessia: "travessia 24s linear infinite",
        // `[01/09]` Fluxo de dados da landing (`landing/FluxoDeDados.jsx`).
        // Sobe da base até o topo. Só `transform` e `opacity` — compositor.
        "subir-dado": "subirDado 1s linear infinite",
      },
      keyframes: {
        pulseNeon: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.6 },
        },
        // Zumbido de neon instável — a palavra HUB "vacila" em momentos
        // irregulares, como uma letra elétrica mal aterrada.
        //
        // `[29/08]` `textShadow` SAIU dos keyframes, e sobrou só `opacity`.
        //
        // O motivo veio do PageSpeed do dono, no aviso "Evitar animações não
        // compostas — 1 elemento animado": `text-shadow` NÃO roda no
        // compositor. Cada quadro dos 5 s de laço infinito repintava, na
        // thread principal, um brilho de 60px de raio — e o elemento em
        // questão é justamente o **LCP da landing** (o `HUB` do título), que
        // aparecia com 2.780 ms de atraso de renderização.
        //
        // `opacity` roda no compositor e faz quase o mesmo serviço: ela
        // atenua o texto E o brilho dele juntos, então a palavra continua
        // "vacilando" como neon mal aterrado. O que se perde é a variação do
        // RAIO do brilho entre um pisca e outro — mudança sutil, e o preço
        // dela era repintar o maior texto da página 60 vezes por segundo,
        // para sempre.
        //
        // O brilho em si não sumiu: ele é estático, no `style` do próprio
        // span em `ElectricTitle.jsx`.
        electricBuzz: {
          "0%, 100%": { opacity: 1 },
          "8%": { opacity: 0.7 },
          "10%": { opacity: 1 },
          "53%": { opacity: 1 },
          "55%": { opacity: 0.5 },
          "57%": { opacity: 1 },
          "78%": { opacity: 0.85 },
          "80%": { opacity: 1 },
        },
        // Arco elétrico: "estala" — surge, treme entre brilho forte e fraco
        // (como descarga real) e some, ficando invisível no resto do ciclo.
        // Durações/atrasos diferentes por arco dão disparos espaçados.
        electricArc: {
          "0%, 100%": { opacity: 0 },
          "87%": { opacity: 0 },
          "89%": { opacity: 1 },
          "91%": { opacity: 0.25 },
          "93%": { opacity: 0.9 },
          "96%": { opacity: 0 },
        },
        // O raio-logo da cena leve respira devagar, imitando o `useBob()` que
        // a versão 3D aplica no mesmo objeto.
        boltFloat: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-14px) rotate(2deg)" },
        },
        // `[10/09]` Os anéis giram no próprio eixo. A inclinação de cada um vem
        // do `transform` da elipse (em `pecasDaCena.js`); aqui só o giro, para
        // os dois não brigarem pela mesma propriedade.
        anelOrbita: {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        // O núcleo respira. É a "fonte de energia" da composição — quem pulsa
        // é ele, e o resto responde.
        nucleoPulsa: {
          "0%, 100%": { transform: "translate(-50%, -50%) scale(1)",    opacity: 0.62 },
          "50%":      { transform: "translate(-50%, -50%) scale(1.11)", opacity: 0.92 },
        },
        // O raio flutua MENOS que os fragmentos, de propósito: o protagonista
        // fica quase parado e o entorno se move. Invertido, a cena embrulha.
        raioRespira: {
          "0%, 100%": { transform: "translateX(-50%) translateY(0)      scale(1)" },
          "50%":      { transform: "translateX(-50%) translateY(-10px) scale(1.012)" },
        },
        // Os fragmentos derivam devagar, cada um com fase própria pelo
        // `animationDelay` negativo.
        //
        // **Este keyframe só translada, e isso é obrigatório.** `transform` de
        // `@keyframes` SUBSTITUI o `transform` do elemento por inteiro — se o
        // giro de cada fragmento estivesse no mesmo elemento, ele sumiria no
        // primeiro quadro. Por isso o `Fragmento` usa dois divs: o de fora
        // posiciona e gira, o de dentro anima. É a mesma pegadinha que já tinha
        // descentralizado o raio da cena antiga.
        fragmentoFlutua: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%":      { transform: "translate3d(6px, -26px, 0)" },
        },
        // As formas de contorno derivam com amplitude maior e fase própria
        // (cada uma recebe um `animationDelay` negativo diferente).
        // Entra por um lado, cruza a tela e sai pelo outro, girando devagar.
        // A opacidade abre e fecha nas pontas para a forma não "aparecer do
        // nada" nem sumir cortada na borda.
        // Um traço de dado subindo: entra por baixo, atravessa e some no topo.
        // A opacidade abre e fecha nas pontas para nada "aparecer do nada".
        subirDado: {
          "0%":       { transform: "translate3d(0, 0, 0) scaleY(0.4)", opacity: 0 },
          "10%, 80%": { opacity: 1 },
          "100%":     { transform: "translate3d(0, -102vh, 0) scaleY(1)", opacity: 0 },
        },
        travessia: {
          "0%":        { transform: "translate3d(-12vw, 0, 0) rotate(0deg)", opacity: 0 },
          "12%, 88%":  { opacity: 1 },
          "100%":      { transform: "translate3d(112vw, -18vh, 0) rotate(160deg)", opacity: 0 },
        },
        shapeDrift: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-22px) rotate(7deg)" },
        },
        slideIn: {
          from: { transform: "translateX(-20px)", opacity: 0 },
          to: { transform: "translateX(0)", opacity: 1 },
        },
        fadeUp: {
          from: { transform: "translateY(10px)", opacity: 0 },
          to: { transform: "translateY(0)", opacity: 1 },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
    },
  },
  plugins: [],
};
