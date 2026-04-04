import HeaderAuth from "./HeaderAuth";

export default function Header() {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-stone-200 flex items-center justify-between px-4">
      <span className="font-display text-xl text-stone-700 leading-none tracking-tight">
        Gårdsguiden
      </span>
      <HeaderAuth />
    </header>
  );
}
