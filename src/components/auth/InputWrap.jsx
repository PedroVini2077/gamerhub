export function InputWrap({ children }) {
  return (
    <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
      {children}
    </div>
  );
}
