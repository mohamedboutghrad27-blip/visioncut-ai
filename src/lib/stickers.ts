/**
 * Free sticker search for VisionCut AI (zero-cost, no API key).
 *
 * Primary source: OpenMoji (https://openmoji.org — CC BY-SA 4.0), 1860 base
 * sticker PNGs (618x618, transparent) served from the jsDelivr CDN. The
 * search index is bundled at src/data/openmoji-index.json (built by
 * scripts/build-openmoji-index.py from the official metadata), so search is
 * instant, offline-capable and has no rate limits.
 *
 * Optional upgrade: set TENOR_API_KEY (free from Google Cloud — Tenor API v2)
 * to merge animated transparent GIF stickers into results. Without it the
 * OpenMoji engine always works for free.
 *
 * Arabic queries are supported through a built-in AR->EN keyword dictionary
 * (e.g. "قلب" -> heart, "قطة" -> cat, "صاروخ" -> rocket).
 */

import index from "@/data/openmoji-index.json";

export interface StickerHit {
  id: string; // hexcode (or tenor id)
  source: "openmoji" | "tenor";
  emoji?: string;
  annotation: string;
  group?: string;
  url: string; // full-size image (transparent)
  thumbUrl: string;
}

const OPENMOJI_BASE = "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@latest/color/618x618";

/* AR -> EN sticker keyword dictionary (compact, covers common search terms) */
const AR_EN: Record<string, string> = {
  "قلب": "heart", "قلوب": "heart", "حب": "love", "قطة": "cat", "قط": "cat", "قطط": "cat",
  "كلب": "dog", "ضحك": "laugh", "ضحكة": "laugh", "ابتسامة": "smile", "ابتسام": "smile",
  "نار": "fire", "لهب": "fire", "نجمة": "star", "نجوم": "star", "صاروخ": "rocket",
  "مال": "money", "فلوس": "money", "ذهب": "gold", "كنز": "treasure", "جوهرة": "gem",
  "ماسة": "diamond", "تاج": "crown", "ملك": "king", "ملكة": "queen", "أمير": "prince",
  "كأس": "trophy", "جائزة": "prize", "ميدالية": "medal", "تصفيق": "clap", "أصفق": "clap",
  "إعجاب": "thumbs", "ممتاز": "thumbs", "احتفال": "party", "حفلة": "party", "عيد": "celebration",
  "هدية": "gift", "بالون": "balloon", "كرات": "balloon", "موسيقى": "music", "أغنية": "song",
  "فيلم": "movie", "سينما": "cinema", "كاميرا": "camera", "صورة": "photo", "هاتف": "phone",
  "جوال": "phone", "لابتوب": "laptop", "حاسوب": "computer", "شاشة": "screen", "بطارية": "battery",
  "شمس": "sun", "قمر": "moon", "نجوم": "stars", "سحابة": "cloud", "مطر": "rain",
  "ثلج": "snow", "برق": "lightning", "قوس": "rainbow", "زهرة": "flower", "ورد": "rose",
  "شجرة": "tree", "نخلة": "palm", "ورقة": "leaf", "بحر": "ocean", "موجة": "wave",
  "سمكة": "fish", "طير": "bird", "طائر": "bird", "نحلة": "bee", "فراشة": "butterfly",
  "أسد": "lion", "نمر": "tiger", "دب": "bear", "أرنب": "rabbit", "فأر": "mouse",
  "قرد": "monkey", "حصان": "horse", "بقرة": "cow", "دجاجة": "chicken", "بط": "duck",
  "صقر": "eagle", "ذئب": "wolf", "ثعلب": "fox", "زرافة": "giraffe", "فيل": "elephant",
  "بطريق": "penguin", "بومة": "owl", "دولفين": "dolphin", "حوت": "whale", "سلحفاة": "turtle",
  "ثعبان": "snake", "عقرب": "scorpion", "حشرة": "bug", "عنكبوت": "spider",
  "طعام": "food", "أكل": "food", "بيتزا": "pizza", "برجر": "burger", "قهوة": "coffee",
  "شاي": "tea", "عصير": "juice", "حلوى": "candy", "كيك": "cake", "آيس": "icecream",
  "تفاح": "apple", "موز": "banana", "فراولة": "strawberry", "بطيخ": "watermelon", "عنب": "grapes",
  "خبز": "bread", "جبن": "cheese", "دجاج": "poultry", "لحم": "meat",
  "كرة": "ball", "كرة قدم": "soccer", "سلة": "basketball", "رياضة": "sport", "سباق": "race",
  "دراجة": "bicycle", "سيارة": "car", "طائرة": "airplane", "سفينة": "ship", "قارب": "boat",
  "قطار": "train", "سفر": "travel", "خريطة": "map", "علم": "flag", "بوصلة": "compass",
  "جبل": "mountain", "صحراء": "desert", "جزيرة": "island", "بركان": "volcano", "غابة": "forest",
  "منزل": "house", "بيت": "home", "مدرسة": "school", "كتاب": "book", "قلم": "pen",
  "ورقة": "paper", "مفتاح": "key", "قفل": "lock", "ساعة": "clock", "منبه": "alarm",
  "مرآة": "mirror", "نظارة": "glasses", "قبعة": "hat", "حذاء": "shoe", "قميص": "shirt",
  "حقيبة": "bag", "ظرف": "envelope", "رسالة": "message", "مكالمة": "call", "بحث": "search",
  "تحذير": "warning", "خطر": "danger", "حظر": "prohibited", "صح": "check", "خطأ": "cross",
  "سؤال": "question", "تعجب": "exclamation", "فكرة": "idea", "تفكير": "thinking",
  "نوم": "sleep", "مرض": "sick", "طبيب": "doctor", "دواء": "medicine", "مستشفى": "hospital",
  "غضب": "angry", "غاضب": "angry", "بكاء": "cry", "يبكي": "cry", "خوف": "fear", "رعب": "scared",
  "مفاجأة": "surprised", "ملل": "bored", "دوار": "dizzy", "غمزة": "wink", "قكمزة": "wink",
  "صمت": "shushing", "همس": "whisper", "قئ": "vomit", "شراب": "drink", "نرد": "dice",
  "لعبة": "game", "وسيلة": "controller", "بازل": "puzzle", "شطرنج": "chess", "ورق": "cards",
  "قوس قزح": "rainbow", "مطرقة": "hammer", "مفتاح ربط": "wrench", "سيف": "sword", "درع": "shield",
  "قنبلة": "bomb", "جرس": "bell", "شمعة": "candle", "دمية": "doll", "بالونات": "balloons",
  "سكين": "knife", "شوكة": "fork", "ملعقة": "spoon", "طبق": "plate", "كوب": "cup",
  "زجاجة": "bottle", "سلة تسوق": "shopping", "مال": "dollar", "يورو": "euro", "بنك": "bank",
  "بطاقة": "card", "فاكس": "fax", "طابعة": "printer", "ماوس": "mouse", "لوحة": "keyboard",
  "قرص": "disk", "شبكة": "network", "واي فاي": "wifi", "إشارة": "signal", "قمر صناعي": "satellite",
  "تلفاز": "tv", "راديو": "radio", "ميكروفون": "microphone", "سماعة": "headphones",
  "عين": "eye", "أذن": "ear", "أنف": "nose", "فم": "mouth", "لسان": "tongue",
  "يد": "hand", "إبهام": "thumb", "قبضة": "fist", "سلام": "peace", "صلصة": "victory",
  "عضلات": "muscle", "دماغ": "brain", "روبوت": "robot", "فضاء": "space", "كوكب": "planet",
  "مجرة": "galaxy", "أجنبي": "alien", "مهرج": "clown", "شبح": "ghost", "هيكل": "skull",
  "زومبي": "zombie", "جامعة": "graduation", "حفل": "party", "زفاف": "wedding", "مولود": "baby",
  "عائلة": "family", "رجل": "man", "امرأة": "woman", "طفل": "child", "مستخدم": "user",
  "شرطة": "police", "نار": "flame", "مطافئ": "firefighter", "مزارع": "farmer", "طاهي": "cook",
  "مهندس": "engineer", "عالِم": "scientist", "فنان": "artist", "معلم": "teacher", "قاضي": "judge",
};

const GROUP_LABELS: Record<string, string> = {
  "smileys-emotion": "Smileys & Emotion",
  "people-body": "People & Body",
  "animals-nature": "Animals & Nature",
  "food-drink": "Food & Drink",
  "travel-places": "Travel & Places",
  "activities": "Activities",
  "objects": "Objects",
  "symbols": "Symbols",
  "flags": "Flags",
};

export const STICKER_GROUPS = Object.entries(GROUP_LABELS).map(([id, label]) => ({ id, label }));

/* Curated default grid when the query is empty */
const DEFAULT_HEXCODES = [
  "1F525", "2728", "2764", "1F602", "1F60D", "1F923", "1F44F", "1F44D",
  "1F31F", "1F680", "1F48E", "1F3C6", "1F451", "1F3AF", "1F389", "1F381",
  "1F3B5", "1F3AC", "1F4A1", "1F4AF", "1F511", "1F512", "26A1", "1F308",
  "1F31E", "1F319", "26C5", "1F327", "2744", "1F525", "1F339", "1F33A",
  "1F341", "1F334", "1F43B", "1F43C", "1F431", "1F436", "1F430", "1F98A",
  "1F984", "1F42F", "1F435", "1F436", "1F427", "1F41D", "1F98B", "1F419",
];

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[\s,،]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Map Arabic tokens to English equivalents (identity for everything else). */
function toEnglishTokens(tokens: string[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    out.push(t);
    const mapped = AR_EN[t];
    if (mapped) {
      out.push(...mapped.split(/\s+/));
      continue;
    }
    // strip common Arabic prefixes/suffixes for lookup ("القلب" -> "قلب")
    const bare = t.replace(/^(ال|و|ف|ب|ل|ك)/, "");
    if (bare !== t && AR_EN[bare]) out.push(...AR_EN[bare].split(/\s+/));
  }
  return out;
}

export function searchStickers(query: string, opts: { group?: string; limit?: number } = {}): StickerHit[] {
  const limit = Math.min(Math.max(opts.limit ?? 48, 1), 96);
  const group = opts.group;

  const raw = index as Array<{ e: string; h: string; a: string; t: string; g: string }>;
  const byGroup = group ? raw.filter((s) => s.g === group) : raw;

  const tokens = toEnglishTokens(tokenize(query));

  // Direct emoji input ("😀") -> exact match
  const qChars = Array.from(query.trim());
  if (qChars.length === 1 && /[\u2190-\u2BFF\u2600-\u27BF\u{1F000}-\u{1FAFF}]/u.test(qChars[0])) {
    const exact = raw.filter((s) => s.e === qChars[0]).slice(0, limit);
    if (exact.length) return exact.map(toHit);
  }

  if (!tokens.length) {
    const defaults = DEFAULT_HEXCODES.map((h) => raw.find((s) => s.h === h)).filter(Boolean) as typeof raw;
    const pool = group ? byGroup : defaults;
    return pool.slice(0, limit).map(toHit);
  }

  const scored: Array<{ s: (typeof raw)[number]; score: number }> = [];
  for (const s of byGroup) {
    let score = 0;
    for (const tok of tokens) {
      if (!tok) continue;
      if (s.a === tok) score += 6; // exact annotation
      if (s.a.split(/\s+/).includes(tok)) score += 4; // annotation word
      if (s.t.split(/,\s*/).includes(tok)) score += 3; // exact tag
      if (s.a.includes(tok)) score += 2; // substring
      if (s.t.includes(tok)) score += 1;
      if (s.g.replace(/-/g, " ").includes(tok)) score += 1;
    }
    if (score > 0) scored.push({ s, score });
  }
  scored.sort((x, y) => y.score - x.score || x.s.a.localeCompare(y.s.a));
  return scored.slice(0, limit).map((x) => toHit(x.s));
}

function toHit(s: { e: string; h: string; a: string; g: string }): StickerHit {
  const url = `${OPENMOJI_BASE}/${encodeURIComponent(s.h)}.png`;
  return {
    id: s.h,
    source: "openmoji",
    emoji: s.e,
    annotation: s.a,
    group: s.g,
    url,
    thumbUrl: url,
  };
}

/**
 * Optional Tenor v2 merge (animated transparent GIF stickers) — active only
 * when TENOR_API_KEY is configured. Free key: https://developers.google.com/tenor
 */
export async function searchStickersWithTenor(
  query: string,
  opts: { group?: string; limit?: number } = {},
): Promise<StickerHit[]> {
  const base = searchStickers(query, opts);
  const key = process.env.TENOR_API_KEY?.trim();
  if (!key) return base;
  const q = (query || "trending sticker").trim();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://g.tenor.com/v2/search?q=${encodeURIComponent(q)}&key=${key}` +
        `&media_filter=webp_transparent,tinywebp_transparent&contentfilter=medium&limit=24`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return base;
    const body = (await res.json()) as {
      results?: Array<{ id: string; content_description?: string; media_formats?: Record<string, { url?: string }> }>;
    };
    const tenor: StickerHit[] = (body.results || [])
      .map((r) => ({
        id: `tenor-${r.id}`,
        source: "tenor" as const,
        annotation: r.content_description || q,
        url: r.media_formats?.webp_transparent?.url || r.media_formats?.tinywebp_transparent?.url || "",
        thumbUrl: r.media_formats?.tinywebp_transparent?.url || r.media_formats?.webp_transparent?.url || "",
      }))
      .filter((s) => s.url && s.thumbUrl);
    // animated stickers first, then OpenMoji stills
    return [...tenor, ...base].slice(0, Math.max(opts.limit ?? 48, tenor.length));
  } catch {
    return base; // Tenor is a bonus, never a blocker
  }
}
