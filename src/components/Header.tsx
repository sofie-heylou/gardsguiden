export default function Header() {
  return (
    <header className="h-14 shrink-0 bg-stone-800 flex items-center px-4 gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-amber-100 leading-none">
          Gårdsguiden
        </span>
        <span className="text-xs text-stone-400 hidden sm:block">
          Hitta gårdar nära dig
        </span>
      </div>
    </header>
  );
}
