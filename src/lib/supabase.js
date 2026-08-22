import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sem as variáveis, o `createClient` lança "supabaseUrl is required" durante a
// carga do módulo — antes do React montar. O resultado é uma PÁGINA EM BRANCO
// com o motivo só no console, que ninguém abre. Foi assim que o teste de fumaça
// falhou nas 12 rotas de uma vez sem dizer o porquê.
//
// Isto não conserta a configuração; faz a falha se explicar. Se um dia a
// variável sumir da Vercel, aparece uma tela dizendo o que fazer em vez de
// nada. O caminho feliz abaixo continua idêntico.
if (!supabaseUrl || !supabaseAnonKey) {
  const faltando = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
  ].filter(Boolean).join(' e ');

  const msg = `Configuração ausente: ${faltando}.`;
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                  background:#0a0a0f;color:#e5e7eb;font-family:ui-monospace,monospace;padding:24px">
        <div style="max-width:32rem;border:1px solid #ef444455;border-radius:16px;
                    background:#15151f;padding:28px">
          <p style="color:#f87171;font-weight:700;margin:0 0 12px">
            O site não conseguiu iniciar
          </p>
          <p style="font-size:14px;line-height:1.6;margin:0 0 12px">${msg}</p>
          <p style="font-size:13px;color:#9ca3af;line-height:1.6;margin:0">
            Defina as variáveis de ambiente no painel da Vercel
            (Settings &rarr; Environment Variables) e faça um novo deploy.
          </p>
        </div>
      </div>`;
  }
  throw new Error(`[supabase] ${msg}`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
