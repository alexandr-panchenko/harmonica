interface GlyphProps { x: number; y: number; className?: string }

/** Locally controlled SVG paths: no font or runtime asset fallback. */
export function TrebleClef({ x, y, className = "music-glyph" }: GlyphProps) {
  return <g className={className} transform={`translate(${x} ${y})`} aria-hidden="true">
    <path d="M17 69C2 62 1 44 10 35c8-8 22-8 28 2 7 12-1 27-13 29-13 3-23-7-19-18 3-8 13-11 20-6 5 4 3 13-3 15-5 2-10-2-9-7" />
    <path d="M23 78C31 55 33 33 29 10 26-6 34-22 42-31c8 18 1 34-10 45-10 10-22 18-26 31" />
    <path d="M24 76c9 2 13 9 10 16-2 6-8 9-13 7" />
  </g>;
}

export function RestGlyph({ x, y, className = "music-glyph" }: GlyphProps) {
  return <path className={className} aria-hidden="true" d={`M${x-5} ${y-25}l13 14-9 8 10 10-8 17-5-2 5-12-12-12 9-9-9-10z`} />;
}

export function AccidentalGlyph({ x, y, accidental, className = "accidental" }: GlyphProps & { accidental?: "sharp" | "flat" | "natural" }) {
  if (!accidental) return null;
  if (accidental === "sharp") return <g className={className} aria-hidden="true"><path d={`M${x-7} ${y-20}v36M${x+5} ${y-23}v36M${x-12} ${y-8}l23-5M${x-12} ${y+5}l23-5`} /></g>;
  if (accidental === "flat") return <path className={className} aria-hidden="true" d={`M${x-4} ${y-25}v43c14-5 17-21 5-22-5 0-6 5-5 10`} />;
  return <g className={className} aria-hidden="true"><path d={`M${x-6} ${y-22}v34l12-5v-34M${x-6} ${y-4}l12-5`} /></g>;
}
