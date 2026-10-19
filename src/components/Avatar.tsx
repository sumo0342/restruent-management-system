const PALETTE = [
  { bg: "#C23D1C", fg: "#F7F5F0" }, // flame
  { bg: "#8F6425", fg: "#F7F5F0" }, // brass
  { bg: "#1F5C4E", fg: "#F7F5F0" }, // verdigris
  { bg: "#5C564D", fg: "#F7F5F0" }, // smoke
  { bg: "#4A5D8C", fg: "#F7F5F0" }, // steel-blue accent, used nowhere else — keeps avatars distinguishable
];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZES = {
  sm: "w-7 h-7 text-[11px]",
  md: "w-9 h-9 text-xs",
  lg: "w-12 h-12 text-sm",
} as const;

export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: keyof typeof SIZES;
}) {
  const { bg, fg } = colorFor(name);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${SIZES[size]}`}
      style={{
        background: `linear-gradient(155deg, ${bg}, ${bg}cc)`,
        color: fg,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 6px -2px rgba(0,0,0,0.35)",
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
