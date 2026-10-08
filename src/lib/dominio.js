/**
 * `[08/10]` O ENDEREÇO PÚBLICO DO SITE — uma fonte só.
 *
 * ── Por que isto deixou de ser uma constante local ────────────────────────
 *
 * Ele já existia escrito à mão em `lib/metaDaPagina.js` e no teste de
 * `robots/sitemap`. O app Android obrigou a um terceiro uso, e três cópias da
 * mesma string é a divergência do §4 esperando acontecer — com o agravante de
 * que, aqui, divergir significa **mandar o usuário para um site que não é o
 * nosso**.
 *
 * ── O caso que o tornou necessário, e ele é do Android ────────────────────
 *
 * `supabase.auth.resetPasswordForEmail` recebia
 * `window.location.origin + '/auth/confirm'`. Na web isso É o site. Dentro de
 * um app Capacitor, `window.location.origin` passa a ser **`https://localhost`**
 * — um endereço que o Supabase recusa (não está na lista de redirecionamentos)
 * e que não abriria o app a partir de um email de qualquer jeito.
 *
 * O link de recuperação passa a apontar SEMPRE para o site. No navegador nada
 * muda; no app, o email abre o site no navegador do celular, que é onde a
 * pessoa troca a senha. **Quando os App Links existirem** (exigem
 * `assetlinks.json` no domínio e a impressão da chave de assinatura), o mesmo
 * link passa a abrir o app — sem mudar esta linha.
 */
export const ENDERECO_DO_SITE = 'https://gamerhub-nine.vercel.app';
