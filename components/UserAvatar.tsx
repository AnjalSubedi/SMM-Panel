type Props = { id: string; name: string; className?: string };
export default function UserAvatar({ id, name, className = "size-10" }: Props) {
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join("").toUpperCase() || "U";
  const colors = ["bg-blue-600", "bg-zinc-800", "bg-blue-800", "bg-zinc-600"];
  return <span aria-hidden="true" className={"relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md text-sm font-bold text-white " + colors[hash % colors.length] + " " + className}>
    <svg viewBox="0 0 40 40" className="absolute inset-0 size-full opacity-20" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <rect key={index} x={(index % 3) * 14 + (hash >>> (index + 1) & 3)} y={Math.floor(index / 3) * 14} width={6 + (hash >>> (index + 3) & 7)} height="9" fill="white" />)}</svg>
    <span className="relative">{initials}</span>
  </span>;
}
