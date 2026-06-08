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
      },
      keyframes: {
        pulseNeon: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.6 },
        },
        // Zumbido de neon instável — a palavra HUB "vacila" em momentos
        // irregulares, como uma letra elétrica mal aterrada.
        electricBuzz: {
          "0%, 100%": { opacity: 1, textShadow: "0 0 30px #39ff14, 0 0 60px #39ff1450" },
          "8%": { opacity: 0.7, textShadow: "0 0 12px #39ff14" },
          "10%": { opacity: 1, textShadow: "0 0 30px #39ff14, 0 0 60px #39ff1450" },
          "53%": { opacity: 1 },
          "55%": { opacity: 0.5, textShadow: "0 0 8px #39ff14" },
          "57%": { opacity: 1, textShadow: "0 0 30px #39ff14, 0 0 60px #39ff1450" },
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
