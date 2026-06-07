import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Após um novo deploy, os hashes dos chunks lazy (rotas em `lazy(() => import(...))`)
// mudam — uma aba aberta com o bundle antigo tenta buscar um arquivo que não existe
// mais e cai na tela "Algo deu errado" ao navegar pra uma rota ainda não carregada.
// Recarrega a página uma vez para pegar o bundle novo (com limite de 1x/10s pra
// não entrar em loop caso o erro seja persistente — aí o ErrorBoundary assume).
const CHUNK_RELOAD_KEY = 'gh_chunk_reload_at';
window.addEventListener('vite:preloadError', (event) => {
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
  const now = Date.now();
  if (now - last > 10000) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
    event.preventDefault();
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
