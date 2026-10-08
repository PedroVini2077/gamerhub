import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { iniciarMonitoramento } from './lib/monitoring';
import { registrarServicoDeCache } from './lib/servicoDeCache';
import { capturarConviteDeInstalacao } from './lib/conviteDeInstalacao';

// Liga o monitoramento ANTES de qualquer coisa: erro que acontece durante a
// montagem do app é justamente o mais grave, e o que ninguém vê acontecer.
iniciarMonitoramento();

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

// `[08/10]` O cache de assets e a tela de offline. Ele sozinho decide se deve
// existir (só em produção, só se o navegador tiver, só depois do `load`) — e
// NÃO cacheia HTML, então o tratador de `vite:preloadError` acima continua
// funcionando: hash velho segue dando 404 e a aba recarrega para pegar o novo.
registrarServicoDeCache();

// `[08/10]` O `beforeinstallprompt` dispara UMA vez e normalmente ANTES do
// React montar. Um ouvinte dentro de componente chega tarde e nunca vê o
// evento — o convite de instalar simplesmente não apareceria, sem erro e sem
// log (§1.5). Por isso a captura é aqui.
capturarConviteDeInstalacao();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
