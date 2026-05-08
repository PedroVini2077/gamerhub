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
      },
      keyframes: {
        pulseNeon: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.6 },
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
