/**
 * A casca dos campos de formulário do site.
 *
 * `[05/09]` Ganhou o estado de ERRO. Ele já existia, escrito à mão dentro do
 * `RegisterForm` para a borda vermelha do "confirmar senha" — e uma casca
 * duplicada é uma casca que diverge (§4). Aditivo: sem a prop, o resultado é
 * byte a byte o de antes.
 */
export function InputWrap({ children, erro = false }) {
  const borda = erro
    ? 'border-red-400/60'
    : 'border-dark-400 focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420]';

  return (
    <div className={`flex items-center bg-dark-700 border rounded-md transition-all ${borda}`}>
      {children}
    </div>
  );
}
