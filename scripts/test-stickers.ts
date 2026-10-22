/**
 * Local check of the sticker search engine (src/lib/stickers.ts).
 * Run: npx tsx scripts/test-stickers.ts  (no key, no network for search itself)
 */
import { searchStickers, STICKER_GROUPS } from "../src/lib/stickers";

function show(label: string, hits: ReturnType<typeof searchStickers>) {
  console.log(`\n== ${label} -> ${hits.length} hits`);
  for (const h of hits.slice(0, 4)) console.log(`   ${h.emoji || " "} ${h.id}  ${h.annotation}  [${h.group}]`);
}

const groups = STICKER_GROUPS.map((g) => g.id).join(",");
console.log("groups:", groups);

show('english "cat"', searchStickers("cat"));
show('arabic "قطة"', searchStickers("قطة"));
show('arabic "قلب"', searchStickers("قلب"));
show('arabic "صاروخ"', searchStickers("صاروخ"));
show('arabic with prefix "القلب"', searchStickers("القلب"));
show('emoji direct "😀"', searchStickers("😀"));
show('empty (defaults)', searchStickers(""));
show('group filter animals " "', searchStickers("", { group: "animals-nature" }));
show('english "fire"', searchStickers("fire"));

const cat = searchStickers("قطة");
if (!cat.length || !cat[0].annotation.includes("cat")) {
  console.error("\nFAIL: arabic cat search did not return a cat");
  process.exit(1);
}
console.log("\nPASS");
