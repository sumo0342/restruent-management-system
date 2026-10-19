import React from "react";
import Image from "next/image";

type StickerImageType = "chef" | "food" | "badge";

interface StickerImageProps {
  type: StickerImageType;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  tilt?: "left" | "right" | "slight-left" | "slight-right" | "none";
  className?: string;
  caption?: string;
  onClick?: () => void;
}

const STICKER_PATHS: Record<StickerImageType, { src: string; alt: string; defaultCaption: string }> = {
  chef: {
    src: "/stickers/chef.jpg",
    alt: "Happy Chef Sticker",
    defaultCaption: "Chef Approved",
  },
  food: {
    src: "/stickers/food.jpg",
    alt: "Steaming Gourmet Dish Sticker",
    defaultCaption: "Freshly Cooked",
  },
  badge: {
    src: "/stickers/badge.jpg",
    alt: "100% Fresh Spices & Herbs Seal",
    defaultCaption: "100% Pure Spices",
  },
};

const SIZES = {
  xs: "w-10 h-10",
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-36 h-36 md:w-44 md:h-44",
  xl: "w-48 h-48 md:w-60 md:h-60",
};

const TILTS = {
  left: "-rotate-6 hover:-rotate-1",
  "slight-left": "-rotate-2 hover:rotate-0",
  right: "rotate-6 hover:rotate-1",
  "slight-right": "rotate-3 hover:rotate-0",
  none: "rotate-0",
};

export function StickerImage({
  type,
  size = "md",
  tilt = "slight-right",
  className = "",
  caption,
  onClick,
}: StickerImageProps) {
  const meta = STICKER_PATHS[type];

  return (
    <div
      onClick={onClick}
      className={`group relative inline-flex flex-col items-center select-none transition-all duration-300 ease-out hover:scale-105 ${TILTS[tilt]} ${className} ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {/* Vinyl die-cut container with white sticker border & deep paper drop shadow */}
      <div
        className={`relative ${SIZES[size]} rounded-2xl md:rounded-3xl overflow-hidden bg-white p-1 border-[3.5px] border-white shadow-[0_12px_28px_-6px_rgba(0,0,0,0.55),0_6px_12px_-4px_rgba(0,0,0,0.35)] ring-1 ring-black/10`}
      >
        {/* Glossy sticker sheen reflection */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-tr from-white/0 via-white/20 to-white/60 opacity-60 group-hover:opacity-85 transition-opacity"
        />

        {/* Inner sticker image */}
        <div className="relative w-full h-full rounded-xl md:rounded-2xl overflow-hidden bg-white">
          <Image
            src={meta.src}
            alt={meta.alt}
            fill
            sizes="(max-width: 768px) 150px, 250px"
            className="object-contain p-0.5"
            priority={size === "lg" || size === "xl"}
          />
        </div>
      </div>

      {caption && (
        <span className="mt-1.5 px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase bg-[#FAF8F5] text-[#0A261E] rounded-full shadow-md border border-[#0A261E]/10 whitespace-nowrap">
          {caption}
        </span>
      )}
    </div>
  );
}

interface StickerBadgeProps {
  text: string;
  icon?: string;
  variant?: "deepGreen" | "offWhite" | "amber" | "mint";
  tilt?: "left" | "right" | "slight-left" | "slight-right" | "none";
  className?: string;
}

export function StickerBadge({
  text,
  icon = "🌿",
  variant = "offWhite",
  tilt = "slight-left",
  className = "",
}: StickerBadgeProps) {
  const variantStyles = {
    offWhite:
      "bg-[#FAF8F5] text-[#0A261E] border-2 border-white shadow-[0_6px_18px_rgba(0,0,0,0.35)] ring-1 ring-[#0A261E]/15",
    deepGreen:
      "bg-[#0D3327] text-[#FAF8F5] border-2 border-[#FAF8F5]/80 shadow-[0_6px_18px_rgba(0,0,0,0.45)] ring-1 ring-emerald-400/30",
    amber:
      "bg-amber-400 text-[#0A261E] border-2 border-white shadow-[0_6px_18px_rgba(0,0,0,0.35)] ring-1 ring-amber-600/20",
    mint:
      "bg-emerald-500 text-[#061812] border-2 border-white shadow-[0_6px_18px_rgba(0,0,0,0.35)] ring-1 ring-emerald-700/20",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-xl select-none transition-transform duration-200 hover:scale-105 ${TILTS[tilt]} ${variantStyles[variant]} ${className}`}
    >
      <span className="text-sm shrink-0 leading-none">{icon}</span>
      <span>{text}</span>
    </span>
  );
}

export function StickerCornerBadge({
  label = "CHEF PICK",
  variant = "amber",
}: {
  label?: string;
  variant?: "amber" | "mint" | "offWhite";
}) {
  const styles = {
    amber: "bg-amber-400 text-stone-900 border-white",
    mint: "bg-emerald-400 text-emerald-950 border-white",
    offWhite: "bg-[#FAF8F5] text-[#0B2A20] border-emerald-900/20",
  };

  return (
    <span
      className={`absolute -top-2.5 -right-2 px-2 py-0.5 text-[10px] font-black tracking-widest uppercase rounded-md border-2 shadow-md transform rotate-6 select-none z-10 ${styles[variant]}`}
    >
      {label}
    </span>
  );
}
