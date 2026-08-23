export const TRACKS = ["Java", "C#", "Golang"] as const;
export type Track = (typeof TRACKS)[number];

export const DIGEST_SECTIONS = [
  { key: "declarations", title: "Декларации (пропуски / опоздания):" },
  { key: "interviews", title: "Требуют особого внимания на этапе собеседований:" },
  { key: "legend", title: "Требуют особого внимания на этапе легенда/резюме:" },
  { key: "cards", title: "Карточки:" },
] as const;

export type DigestSection = (typeof DIGEST_SECTIONS)[number]["key"];

export const SECTION_KEYS = DIGEST_SECTIONS.map((s) => s.key) as DigestSection[];

export function sectionTitle(key: string) {
  return DIGEST_SECTIONS.find((s) => s.key === key)?.title ?? key;
}

/** Monday of the week containing `d` (UTC-safe, date-only string). */
export function mondayOf(d: Date = new Date()): string {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow);
  return x.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dm(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}`;
}

export function weekRangeLabel(weekStart: string) {
  return `${dm(weekStart)} - ${dm(addDaysISO(weekStart, 6))}`;
}


export type DigestEntry = {
  id: string;
  track: string;
  section: string;
  student_name: string;
  comment: string;
  flagged: boolean;
  week_start: string;
};

/**
 * Renders the digest as plain text. Bold is expressed with markdown `**`,
 * which Telegram-style clients and the preview both understand.
 */
export function renderDigest(track: string, weekStart: string, entries: DigestEntry[]): string {
  const lines: string[] = [];
  lines.push(`**${weekRangeLabel(weekStart)}**`);
  lines.push(`**${track}**`);


  for (const s of DIGEST_SECTIONS) {
    const rows = entries.filter((e) => e.section === s.key);
    if (rows.length === 0) continue;
    lines.push("");
    lines.push(`**${s.title}**`);
    for (const r of rows) {
      const comment = r.comment?.trim();
      lines.push(`${r.student_name}${comment ? ` - ${comment}` : ""}${r.flagged ? " 🔴" : ""}`);
    }
  }

  return lines.join("\n");
}
