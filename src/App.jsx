import { useState, useRef, useEffect } from "react";

const FORM_STORAGE_KEY = "ugc-prompt-generator:form-draft";

// Niche list expanded to mirror Shopee Indonesia's official ~24-26 category structure,
// merged sensibly where categories don't need distinct UGC scene logic (e.g. Handphone +
// Komputer + Elektronik all fold into "tech" since they share the same generic content-type templates).
const NICHES = [
  { id: "beauty",       label: "Beauty & Skincare",        emoji: "✨", color: "#f4a7b9" },
  { id: "fashion",      label: "Fashion & Pakaian",        emoji: "👗", color: "#b5c9f7" },
  { id: "muslim",       label: "Fashion Muslim",           emoji: "🧕", color: "#c9b8e8" },
  { id: "shoes",        label: "Sepatu",                   emoji: "👟", color: "#e8c9a0" },
  { id: "accessories",  label: "Aksesoris Fashion",        emoji: "🕶️", color: "#f0d0e0" },
  { id: "watches",      label: "Jam Tangan",               emoji: "⌚", color: "#c0c8d8" },
  { id: "home",         label: "Home & Lifestyle",         emoji: "🏠", color: "#a8d8a8" },
  { id: "health",       label: "Health & Wellness",        emoji: "💪", color: "#ffd580" },
  { id: "food",         label: "Food & Beverage",          emoji: "🍽️", color: "#ffb37a" },
  { id: "tech",         label: "Tech & Gadgets",           emoji: "📱", color: "#9ecbff" },
  { id: "baby",         label: "Mother & Baby",            emoji: "🍼", color: "#d8b6f7" },
  { id: "pets",         label: "Pet Care",                 emoji: "🐾", color: "#d8b98e" },
  { id: "sports",       label: "Sports & Fitness",         emoji: "🏋️", color: "#7fe0c4" },
  { id: "auto",         label: "Automotive & Tools",       emoji: "🔧", color: "#b8c4d0" },
  { id: "hobby",        label: "Hobi & Koleksi",           emoji: "🎯", color: "#e0b8a8" },
  { id: "books",        label: "Buku & Alat Tulis",        emoji: "📚", color: "#b8d0e8" },
  { id: "party",        label: "Souvenir & Pesta",         emoji: "🎉", color: "#f7c9d8" },
  { id: "photography",  label: "Fotografi",                emoji: "📷", color: "#c0c0c0" },
];

const PLATFORMS = [
  { id: "tiktok",   label: "TikTok",            ratio: "9:16",    duration: "15–60 sec" },
  { id: "reels",    label: "Instagram Reels",   ratio: "9:16",    duration: "15–90 sec" },
  { id: "youtube",  label: "YouTube Shorts",    ratio: "9:16",    duration: "up to 60 sec" },
  { id: "feed",     label: "Instagram Feed",    ratio: "1:1/4:5", duration: "Static / Carousel" },
  { id: "multi",    label: "Multi-platform",    ratio: "Adaptive", duration: "Flexible" },
];

const CONTENT_TYPES = [
  { id: "review",        label: "Product Review",          icon: "⭐", desc: "Unboxing, first impressions, real results" },
  { id: "before_after",  label: "Before & After",          icon: "🔄", desc: "Visual transformation before and after" },
  { id: "lifestyle",     label: "Lifestyle / Storytelling", icon: "🎬", desc: "Product integrated into everyday life" },
];

const AI_GENERATORS = [
  { id: "kling",      label: "Kling AI",               type: "video" },
  { id: "runway",     label: "Runway Gen-3",            type: "video" },
  { id: "sora",       label: "Sora (OpenAI)",           type: "video" },
  { id: "midjourney", label: "Midjourney",              type: "image" },
  { id: "flux",       label: "Flux / Stable Diffusion", type: "image" },
  { id: "pika",       label: "Pika Labs",               type: "video" },
  { id: "auto",       label: "Flexible / Auto",        type: "both" },
];

const FASHION_SUBCATEGORIES = [
  { id: "clothing", label: "Clothing (Sudah Jadi)", emoji: "👗", desc: "Tops, shirts, dresses, outerwear, pants — ready to wear" },
  { id: "fabric",   label: "Kain / Bahan (Belum Dijahit)", emoji: "🧵", desc: "Kain per-meter, bahan mentah — belum berbentuk pakaian" },
  { id: "bag",      label: "Tas (Bags)",            emoji: "👜", desc: "Handbag, slingbag, tote — untuk kacamata/jam/perhiasan pilih niche \"Aksesoris Fashion\" di step sebelumnya" },
];

const SMARTPHONE_BASE = "shot on smartphone, handheld camera, natural shaky movement, amateurish UGC feel, slightly imperfect framing, real-person POV, no tripod, organic motion blur on movement";

const TONES = [
  { id: "energetic",   label: "Energetic & Viral",     style: `fast cuts, bold color grading, high saturation, dynamic handheld camera movement, bright warm tones, pop aesthetic, ${SMARTPHONE_BASE}` },
  { id: "elegant",     label: "Elegant & Premium",     style: `gentle handheld sway, soft bokeh, luxury color palette ivory champagne deep green, soft natural window lighting, ${SMARTPHONE_BASE}` },
  { id: "warm",        label: "Warm & Personal",       style: `handheld natural movement, golden hour lighting, candid feel, warm tones, intimate close-ups, soft vignette, ${SMARTPHONE_BASE}` },
  { id: "educational", label: "Educational & Informative", style: `slightly shaky close-up shots, natural daylight, clear product detail, neutral tones, held in one hand while filming, ${SMARTPHONE_BASE}` },
];

// Fashion niches skip "Content Type" (their scene structure is fixed), so the two flows
// have the same length but diverge in meaning at index 2/3 — see STEP_LABELS_FASHION/NONFASHION below.
const STEP_LABELS_FASHION    = ["Photo", "Niche", "Category", "Platform", "AI Tool", "Tone", "Product", "Confirm"];
const STEP_LABELS_NONFASHION = ["Photo", "Niche", "Platform", "Content",  "AI Tool", "Tone", "Product", "Confirm"];

// Some platform ratios ("1:1/4:5" for Feed, "Adaptive" for Multi-platform) are not
// valid --ar values for Midjourney/Kling/etc. This resolves a safe numeric ratio
// to embed in generator commands, while the human-readable label is kept separately.
const STATIC_PLATFORM_IDS = ["feed"]; // platforms that are photo/carousel, not video

function safeArRatio(ratio) {
  if (!ratio) return "9:16";
  if (ratio === "Adaptive") return "9:16"; // sensible default for multi-platform
  if (ratio.includes("/")) return ratio.split("/")[0].trim(); // "1:1/4:5" -> "1:1"
  return ratio;
}

function buildStaticPrompt({ niche, fashionSub, platform, contentType, aiGen, tone, productName, productBenefit }) {
  const nicheObj    = NICHES.find(n => n.id === niche);
  const platformObj = PLATFORMS.find(p => p.id === platform);
  const contentObj  = CONTENT_TYPES.find(c => c.id === contentType);
  const aiObj       = AI_GENERATORS.find(a => a.id === aiGen);
  const toneObj     = TONES.find(t => t.id === tone);

  const nicheLabel    = nicheObj?.label    || "Product";
  const platformLabel = platformObj?.label || "Multi-platform";
  const contentLabel  = contentObj?.label  || "Content";
  const aiLabel       = aiObj?.label       || "AI Generator";
  const toneLabel     = toneObj?.label     || "Natural";
  const visualStyle   = toneObj?.style     || TONES[2].style;
  const ratio         = platformObj?.ratio    || "9:16";
  const duration      = platformObj?.duration || "Flexible";
  const product       = productName    || "[Product Name]";
  const benefit       = productBenefit || "[Key Product Benefit]";

  const NEG_SHORT = `no speech, no talking, no open mouth, no lip movement, no text overlay, no studio lighting, no tripod, no stabilizer, no gimbal, no watermark`;

  const isKling  = aiGen === "kling";
  const isStatic = STATIC_PLATFORM_IDS.includes(platform); // e.g. Instagram Feed = static photo/carousel, not video

  const makeImageSlide = (num, label, prompt) => (
`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE ${num} — ${label}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖼️ IMAGE PROMPT:
${prompt}`
  );

  const carouselSlides = [
    makeImageSlide(1, "HOOK / COVER", `Photorealistic, shot on smartphone, natural ambient light — ${product} as the clear hero subject, eye-catching first impression, ${nicheLabel} setting. Leave visual space near the top for a bold hook headline to be added in post. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`),
    makeImageSlide(2, "PRODUCT DETAIL", `Macro/close-up shot on smartphone, natural daylight — ${product} showing texture, material, or key feature up close, authentic UGC aesthetic, not studio. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`),
    makeImageSlide(3, "IN USE / CONTEXT", `Photorealistic lifestyle shot on smartphone — ${product} being used or shown in a real everyday setting (desk, room, outdoors), natural light, candid feel. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`),
    makeImageSlide(4, "BENEFIT / RESULT", `Photorealistic shot on smartphone — visual proof of the benefit "${benefit}", natural ambient light, authentic and relatable framing, no studio setup. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`),
    makeImageSlide(5, "CTA SLIDE", `Photorealistic shot on smartphone — ${product} placed cleanly on a table or held toward camera, plenty of negative space for a "Link in bio" / swipe-up text overlay to be added in post. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`),
  ].join("\n\n");

  const klingify = (shot) => {
    const noTs = shot.replace(/^\[\d+:\d+[-–]\d+:\d+\]\s*/, "");
    const sentences = noTs.split(/[.—]+/).filter(s => s.trim().length > 5).slice(0, 2);
    const joined = sentences.join(". ").trim();
    const words = joined.split(/\s+/);
    return (words.length > 40 ? words.slice(0, 40).join(" ") + "..." : joined);
  };

  const SCENE_NEG = `❌ NEGATIVE PROMPT:\nno talking, no speaking, no open mouth, no mouth movement, no dialogue, no lip sync, no lip movement, no voiceover, no verbal communication — IF any model appears: must NOT speak, must NOT open mouth, must be completely silent; no influencer pose, no studio lighting, no tripod, no gimbal, no watermark`;

  const makeScene = (num, label, anchor, sub1, sub2) => {
    if (isKling) {
      return (
`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCENE ${num} — ${label}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖼️ IMAGE ANCHOR (upload to Kling):
${anchor}

🎬 KLING PROMPT — Shot A:
${klingify(sub1)}

🎬 KLING PROMPT — Shot B:
${klingify(sub2)}

❌ NEGATIVE: ${NEG_SHORT}`
      );
    }
    return (
`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCENE ${num} — ${label}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖼️ IMAGE ANCHOR:
${anchor}

\`\`\`
${sub1}

${sub2}
\`\`\`

${SCENE_NEG}`
    );
  };

  const fashionShots = [
    makeScene(1, "INTRO — CLOTHING ON TABLE",
      `Photorealistic, shot on smartphone, handheld UGC — ${product} neatly laid flat on a wooden table or bed surface, natural daylight from window illuminating fabric texture and details. Slightly imperfect framing, no mannequin, no hanger. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
      `[0:00-0:04] Handheld smartphone — slow side-to-side pan across ${product} laid on a table. Natural window light highlights fabric texture. Slight organic sway, no gimbal.`,
      `[0:04-0:08] Camera dips closer to fabric surface — close-up on texture, stitching, or color detail. Autofocus hunts then locks on best detail. Warm ambient light.`
    ),
    makeScene(2, "MODEL SELF-RECORDING",
      `Photorealistic, selfie-mode smartphone shot — person wearing ${product} holding phone at arm's length toward their own face/body, recording themselves, indoor or semi-outdoor setting, natural ambient light, authentic self-filmed UGC feel. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
      `[0:00-0:04] Model holds smartphone at arm's length, angled toward themselves — selfie-style self-recording. ${product} clearly visible on their body. Camera arm slightly unstable, natural shake. Model looks at the phone lens, NOT speaking. Natural indoor or semi-outdoor light.`,
      `[0:04-0:08] Model slowly lowers the phone from face-level down to chest/waist level — revealing more of the ${product} outfit. One hand holds the phone, the other naturally hangs or touches the garment. Organic wrist movement, no stabilization. Model does NOT speak.`
    ),
    makeScene(3, "OUTDOOR — WIDE STATIC SHOT",
      `Photorealistic, wide shot, static camera — person wearing ${product} standing or walking naturally in outdoor setting (street, park, or building exterior), golden hour or natural daylight, full body visible, camera completely stationary. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
      `[0:00-0:04] Wide shot — camera placed or propped still, completely stationary. Person wearing ${product} stands or walks naturally within the frame. Full body visible from head to toe. Camera does NOT move, pan, or tilt. Natural outdoor daylight. Candid feel — model unaware of camera.`,
      `[0:04-0:08] Same static wide angle — model continues natural movement within frame (adjusting outfit, turning slightly, walking past). Camera stays completely locked off. Full outfit visible at all times. Golden hour or bright daylight.`
    ),
    makeScene(4, "CANDID SHOT — WIDE STATIC",
      `Photorealistic, wide shot, static camera — candid full-body shot of person wearing ${product} in natural indoor or outdoor setting, camera completely stationary, no movement, full outfit visible, natural ambient light. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
      `[0:00-0:04] Wide static shot — camera locked off and completely still. Model wearing ${product} moves naturally within frame: walking slowly, looking around, adjusting garment. Full outfit from head to toe visible. No camera movement whatsoever. Natural ambient light.`,
      `[0:04-0:08] Camera remains fully static. Model pauses or slows within frame — wide angle shows complete outfit in environment. ${visualStyle}. Natural light — golden hour or bright daylight.`
    ),
  ];

  const fabricShots = [
    makeScene(1, "INTRO — FLAT-LAY ON FLOOR/TABLE",
      `Photorealistic, shot on smartphone, handheld UGC — ${product} fabric fully unfolded and laid flat on a wooden table or bedroom floor, natural window light revealing the print/texture across the whole visible length, slightly imperfect overhead framing, no mannequin, no sewn garment, no model. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
      `[0:00-0:04] Handheld smartphone hovers above the flat-lay ${product} fabric, unfolded and fully visible. Camera sways slowly side to side, natural window light casts soft shadows revealing texture. No garment, no model — fabric only.`,
      `[0:04-0:08] Camera drifts closer to the fabric surface — close-up on print detail, weave, or texture. Autofocus hunts then locks. Real floor or table background visible at edges.`
    ),
    makeScene(2, "TEXTURE & WEAVE DETAIL",
      `Macro close-up, shot on smartphone, handheld — extreme close-up of ${product} fabric surface showing weave, print detail, and material texture, fingers gently touching or rubbing the fabric to demonstrate softness/quality, natural side lighting. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
      `[0:00-0:04] Macro shot — fingers gently rub or pinch the ${product} fabric between thumb and index finger to show texture and quality. Camera very close, autofocus hunts then locks on weave detail. Natural light.`,
      `[0:04-0:08] Fabric is lifted slightly and lightly shaken or draped over the hand — showing natural drape, flow, and weight of the material. Slight motion blur on movement. Natural ambient light.`
    ),
    makeScene(3, "DRAPE / HANGING REVEAL",
      `Handheld smartphone POV — hand holding one edge of ${product} fabric and letting it hang and drape freely downward, showing the full print/pattern and how the material flows, natural indoor light, no garment shape implied, fabric only. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
      `[0:00-0:04] Hand holds the top edge of the ${product} fabric, letting the rest hang and drape freely downward — full length and print visible. Camera holds steady at a slight distance. Natural indoor light. Fabric only, no garment shape, no model wearing anything.`,
      `[0:04-0:08] Fabric sways gently as it hangs — camera slowly pans down along its length showing the full pattern from top to bottom. Natural light highlights sheen and texture.`
    ),
    makeScene(4, "WIDTH / LENGTH DEMONSTRATION",
      `Handheld smartphone shot — two hands stretching ${product} fabric wide to show its full width and pattern repeat, natural daylight, real home or shop setting, authentic UGC feel, fabric only — no sewn shape. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
      `[0:00-0:04] Two hands stretch the ${product} fabric wide, showing its full width and how the pattern repeats across the material. Natural daylight, real background. Fabric only, no garment.`,
      `[0:04-0:08] Fabric is folded back neatly by hand, ending on a clean flat-lay shot — final hero image of the folded ${product} fabric. ${visualStyle}.`
    ),
  ];

  const shots = {
    review: [
      makeScene(1, "HOOK",
        `Photorealistic, shot on smartphone, handheld UGC — creator's hand reaches into frame lifting ${product} toward camera. Natural window light, bedroom setting, slightly imperfect framing. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] Handheld smartphone POV — creator's hand reaches up from below frame, lifting ${product} directly toward the lens. Camera slightly shaky and imperfect. Natural window light.`,
        `[0:04-0:08] Same handheld POV — camera slowly pulls back, ${product} now fully in frame. Creator's wrist rotates slightly to show front face. Organic sway. ${visualStyle}.`
      ),
      makeScene(2, "PRODUCT DETAIL",
        `Macro close-up shot on smartphone, handheld — ${product} held 5cm from lens, natural daylight from window, authentic texture visible, slightly soft focus on edges, UGC aesthetic. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] Macro shot rear camera — hand holds ${product} close to lens. Natural window light, slight flicker. Autofocus hunts then locks on texture and color detail. Authentic feel.`,
        `[0:04-0:08] Hand slowly rotates product, fingers touch surface to reveal detail. Slight motion blur as hand moves. Natural ambient light, no ring light.`
      ),
      makeScene(3, "DEMONSTRATION",
        `First-person smartphone POV — creator's hands using ${product} in natural setting. Handheld, one hand filming, slightly tilted organic framing, warm room light, real-life background. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] First-person POV — own hand using ${product}. Camera held in one hand, organic framing slightly tilted. Natural texture visible.`,
        `[0:04-0:08] Close-up of hand interacting with product — fingers press or touch the main surface. Room ambient light. No tripod. Organic movement.`
      ),
      makeScene(4, "REACTION",
        `Selfie-mode smartphone shot — creator's face looking directly at front camera with genuine surprised/delighted expression, natural room ambient light, no ring light, casual bedroom background, authentic UGC. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] Selfie mode — face directly to front camera, genuinely surprised or delighted. Room ambient light, not studio. Shoulders and head visible, naturally relaxed.`,
        `[0:04-0:08] Camera slowly tilts down from selfie toward ${product} held below — face-to-product transition. Organic, one continuous motion.`
      ),
      makeScene(5, "RESULT + CTA",
        `Handheld smartphone shot — ${product} held close to lens, creator's hand visible, warm natural backlight, slightly imperfect composition, product fills most of frame. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] ${product} held close to lens, hand visible. Camera slowly moves back — full product reveal. ${visualStyle}.`,
        `[0:04-0:08] Still handheld, ${product} in frame against room or table background. Warm natural light.`
      ),
    ],
    before_after: [
      makeScene(1, "BEFORE",
        `Selfie-mode or handheld POV smartphone shot — creator showing the 'before' condition in natural daylight, real bathroom/bedroom background, slightly dim and muted tone, relatable and authentic. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] Selfie or close-up hand filming the before condition. Natural daylight, camera held slightly shaky. Muted tone, slightly dim. Looks real and relatable.`,
        `[0:04-0:08] Camera slowly pans up and down to capture the "before" state. Handheld, slightly tilted. Real bedroom or bathroom background.`
      ),
      makeScene(2, "TRANSITION",
        `Handheld smartphone — creator's hand covering lens then pulling away to reveal. Natural light shift between before/after. Organic transition, no digital effects. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] Jump cut or hand covers lens then pulls away to reveal. Organic effect, no heavy digital transitions.`,
        `[0:04-0:08] Camera lifts up then comes back down — simple hand-motion reveal. Transition feels natural, like the creator did it intentionally.`
      ),
      makeScene(3, "AFTER",
        `Handheld smartphone POV — same angle as before, but now showing clear result after using ${product}. ${visualStyle}. Brighter natural light, creator's hand slightly trembling with excitement. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] Same angle as BEFORE, but now the result from using ${product} is clearly visible. ${visualStyle}. Camera trembles slightly.`,
        `[0:04-0:08] Close-up of hand or result area — camera held 5cm from subject. Autofocus hunts briefly then locks. Brighter natural light.`
      ),
      makeScene(4, "CLOSE-UP PROOF",
        `Macro handheld smartphone shot — extreme close-up of the result after using ${product}, finger pointing or lightly touching to demonstrate. Natural ambient light, authentic texture, not CGI. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] Macro shot of result using smartphone camera — hand holds area or product 5cm from lens. Autofocus hunting = authentic feel.`,
        `[0:04-0:08] Finger points to or lightly touches the result area. Slight motion blur on movement. Window or warm ambient light.`
      ),
      makeScene(5, "CTA",
        `Handheld overhead smartphone shot — ${product} placed on everyday table, creator's hand visible setting it down. Natural light from above, slightly imperfect composition, real-life surface. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] Product placed on a plain table, filmed from above with one hand. ${visualStyle}.`,
        `[0:04-0:08] Selfie mode — face and product in frame. Natural smile. Warm ambient light.`
      ),
    ],
    lifestyle: [
      makeScene(1, "OPENING",
        `Handheld smartphone panning shot — everyday room/desk setting, ${product} sits naturally in frame among daily items. Morning or golden hour light, warm tones, no staging. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] Everyday room or desk angle, ${product} in frame naturally. Camera pans slowly by hand — no gimbal. ${visualStyle}.`,
        `[0:04-0:08] Hand enters frame, casually picking up or touching ${product}. Natural, unplanned movement. Warm morning light.`
      ),
      makeScene(2, "DAILY ROUTINE",
        `First-person smartphone POV — creator integrating ${product} into daily routine, handheld one hand filming, slightly tilted casual framing, candid real-life moment, natural ambient light. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] POV — own hand using ${product} in daily routine. Selfie mode or held at an angle. Candid, not posed.`,
        `[0:04-0:08] Routine continues — camera shifts slightly as it's held while doing something else. Authentic.`
      ),
      makeScene(3, "EMOTIONAL MOMENT",
        `Intimate handheld close-up — creator's face or hands in warm afternoon window light, soft natural bokeh, no ring light, personal and candid feel. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] Close-up of face or hands, afternoon window light. Camera held close — intimate and personal. No ring light.`,
        `[0:04-0:08] Eyes or feel-good expression — camera very close to face, slight edge defocus. Warm natural light.`
      ),
      makeScene(4, "HERO SHOT",
        `Handheld smartphone — ${product} held toward natural window light, camera positioned in front, natural bokeh background, organic sway. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] Product held toward natural light, smartphone camera in front. Natural close-range bokeh. ${visualStyle}.`,
        `[0:04-0:08] Hand slowly rotates product 45 degrees — light plays across the product surface. Organic natural sway.`
      ),
      makeScene(5, "OUTRO + CTA",
        `Selfie-mode smartphone shot — creator smiling naturally at front camera, casual background, no professional lighting, warm and personal. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
        `[0:00-0:04] Selfie mode — natural smile to front camera. No perfect lighting needed. Real room or location background.`,
        `[0:04-0:08] Product shown toward camera with a smile. Warm natural ambient light.`
      ),
    ],
  };

  const NEG = `❌ NEGATIVE PROMPT (must include):\nno talking, no speaking, no open mouth, no mouth movement, no dialogue, no lip sync, no lip movement, no voiceover, no subtitles, no captions overlay, no text on screen — MODEL RULE: if any male or female model appears in frame, they must NOT speak, open mouth, move lips, or dialogue in any form; model must remain completely silent — no smiling directly at camera, no posing, no staged expression, no looking at camera and smiling, no influencer pose, no fake laugh, no exaggerated reaction, no professional model behavior, no studio lighting, no tripod, no gimbal, no stabilized footage, no green screen, no CGI background, no watermark, no logo`;

  const aiNotes = {
    kling: `🎥 KLING AI — USAGE GUIDE:\n\n⚠️ IMPORTANT — WHY KLING FAILS WITH LONG PROMPTS:\nKling AI rejects prompts that are too long or descriptive. Each video prompt above has been automatically compressed to Kling-safe length (~40 words max).\n\n✅ HOW TO USE:\n1. Upload the IMAGE ANCHOR to Kling (Image-to-Video mode)\n2. Copy the KLING PROMPT text — paste directly into Kling's prompt field\n3. Paste the NEGATIVE section into Kling's negative prompt field\n4. Settings: Duration 5s, Creativity Medium, Camera Movement: Handheld / None\n5. Do NOT add extra description — keep prompts short\n\n📐 Settings:\n- Mode: Image-to-Video\n- Aspect ratio: ${ratio}\n- Motion: ${tone==="energetic"?"Fast":"Slow/Natural"}\n- Camera shake: ON\n- Duration: 5s per clip`,
    runway:     `🎥 RUNWAY GEN-3:\n- Mode: Text-to-Video / Image-to-Video\n- Camera: handheld natural sway, organic motion — avoid stabilized look\n- Add to prompt: "shot on smartphone, UGC aesthetic, natural ambient light"\n- Duration: ${duration}\n\n${NEG}`,
    midjourney: `🖼️ MIDJOURNEY:\n- --ar ${safeArRatio(ratio)} --style raw --stylize 400 --v 6.1\n- Add: "shot on iPhone, handheld, natural room lighting, UGC aesthetic, ${visualStyle}"\n- Avoid: "studio", "commercial", "professional photography"\n\n${NEG.replace("❌ NEGATIVE PROMPT (must include):","❌ NEGATIVE PROMPT (add after --no):")}`,
    flux:       `🖼️ FLUX:\n- Model: Flux Pro  CFG: 5-6  Steps: 25-35\n- Add prompt: "shot on smartphone, slightly imperfect, handheld, natural light"\n- Resolution: ${ratio==="9:16"?"768x1344":"1024x1024"}\n\n${NEG}`,
    pika:       `🎥 PIKA LABS:\n- Aspect ratio: ${ratio}\n- Motion: ${tone==="energetic"?"High (8-10)":"Medium (4-6)"} — set camera shake ON\n- Add: "handheld smartphone footage, organic movement"\n\n${NEG}`,
    sora:       `🎥 SORA:\n- Preset: UGC / Handheld  Duration: ${duration}\n- Style: "shot on smartphone, ${visualStyle}, handheld camera, natural light"\n\n${NEG}`,
    auto:       `⚙️ UNIVERSAL:\n- Video: Kling / Runway / Pika — always enable camera shake / handheld mode\n- Image: Midjourney v6 / Flux Pro — add "shot on smartphone, UGC aesthetic"\n- Aspect ratio: ${ratio}\n- Key phrase to add everywhere: "handheld, natural ambient light, organic motion"\n\n${NEG}`,
  };

  const bagShots = [
    makeScene(1, "INTRO — BAG ON TABLE",
      `Photorealistic, shot on smartphone, handheld UGC — ${product} placed on a wooden table or marble surface, natural daylight from window illuminating leather/fabric texture, hardware details visible. Slightly imperfect framing, no mannequin, no stand. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
      `[0:00-0:04] Handheld smartphone — slow side-to-side pan across ${product} placed on table. Natural light highlights material and hardware. Slight organic sway, no gimbal.`,
      `[0:04-0:08] Camera dips closer to hardware detail — close-up on clasp, zipper pull, logo, or stitching. Autofocus hunts then locks on best detail. Warm window light.`
    ),
    makeScene(2, "HARDWARE & ZIPPER DETAIL",
      `Macro close-up, shot on smartphone, handheld — extreme close-up of ${product} hardware details: zipper pull, metal clasp, stitching edges, logo embossing. Natural side lighting reveals texture depth, soft bokeh background. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
      `[0:00-0:04] Macro shot — finger touches or taps ${product} hardware (zipper, clasp, logo). Camera very close, autofocus hunts briefly then locks. Natural side light reveals material texture depth.`,
      `[0:04-0:08] Hand slowly pulls zipper or opens flap — close-up of opening motion. Slight motion blur on hand movement. Material quality revealed up close. Natural light.`
    ),
    makeScene(3, "EXTERIOR REVEAL — HAND LIFT",
      `Handheld smartphone POV — hand lifting ${product} toward camera, rotating slowly to show all angles, natural ambient light creating soft shadows, authentic product hold, UGC feel. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
      `[0:00-0:04] Hand lifts ${product} from below frame toward camera — front face revealed. Handheld camera follows hand motion slightly. Slow 90-degree rotation shows side and bottom.`,
      `[0:04-0:08] Hand flips ${product} to reveal back and bottom. Close-up on bottom detail (base studs, feet) or side panel. Natural light plays across material.`
    ),
    makeScene(4, "INTERIOR REVEAL",
      `Handheld smartphone POV — hand opening ${product} wide toward camera, interior lining and compartments visible, natural top-down or angled light illuminating inside, authentic UGC feel. ${visualStyle}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`,
      `[0:00-0:04] Hand opens ${product} wide toward camera — interior reveal. Shows inner lining, pockets, and compartments. Camera slightly overhead. Natural light enters the bag.`,
      `[0:04-0:08] Camera pulls out from interior to full exterior shot. ${visualStyle}. Hand holds bag toward camera — final hero shot.`
    ),
  ];

  const shotList = niche === "fashion"
    ? (fashionSub === "bag" ? bagShots : fashionSub === "fabric" ? fabricShots : fashionShots).join("\n\n")
    : (shots[contentType] || shots.review).join("\n\n");
  const aiNote   = aiNotes[aiGen] || aiNotes.auto;

  const HOOK_VARIANTS = [
    `"I was honestly shocked by the results of ${product}..."`,
    `"Okay, I did NOT expect ${product} to be this good..."`,
    `"Nobody told me ${product} would actually change my routine like this."`,
    `"POV: you finally try ${product} after seeing it everywhere..."`,
    `"I almost didn't buy ${product}. Here's why I'm glad I did."`,
  ];
  const hookIndex = Math.abs([...niche].reduce((h,c) => h + c.charCodeAt(0), 0)) % HOOK_VARIANTS.length;
  const hook = HOOK_VARIANTS[hookIndex];

  const caption = `✨ Affiliate/Paid Partnership\n\n🔥 ${hook}\n\nAfter [X days] of using it, here's what I noticed:\n✅ ${benefit}\n✅ [Benefit #2]\n✅ [Benefit #3]\n\nYou have to try this yourself. Link in bio! 👇\n\n#${product.replace(/\s+/g,"")} #${nicheLabel.replace(/[\s&]+/g,"")} #UGC #ad #${platformLabel.replace(/\s+/g,"")}\n\n⚠️ Note: This is a template caption — the bracketed benefits are placeholders. Replace them with real, honest results before posting, and keep any health/beauty claims as personal experience, not guarantees.`;

  const baseImage = `Photorealistic product photo, ${nicheLabel} category, ${product}. ${visualStyle}. Shot on smartphone camera, slightly imperfect composition, natural ambient lighting (window light or room light), handheld feel with subtle motion, authentic UGC aesthetic — NOT studio photography. Aspect ratio ${ratio}. --ar ${safeArRatio(ratio)} --style raw --v 6.1`;

  if (isStatic) {
    return {
      image: baseImage,
      introVideo: `ℹ️ ${platformLabel} adalah format statis (foto/carousel) — tidak perlu video.\nGunakan 5 slide gambar di tab "Carousel Slides" sebagai pengganti video prompt.\n\nSlide 1 (Hook/Cover) ditampilkan di sini sebagai contoh:\n\n${carouselSlides.split("\n\n").slice(0,6).join("\n")}`,
      video: `══════════════════════════════════\n🎯 CAROUSEL SLIDES — ${contentLabel.toUpperCase()}\n══════════════════════════════════\nPRODUCT   : ${product}\nBENEFIT   : ${benefit}\nNICHE     : ${nicheLabel}\nPLATFORM  : ${platformLabel} (${ratio} | ${duration})\nTONE      : ${toneLabel}\nAI TOOL   : ${aiLabel}\nSTYLE     : Static Photo / Natural UGC\n\n──────────────────────────────────\nSLIDE-BY-SLIDE SEQUENCE (${ratio})\n──────────────────────────────────\n\n${carouselSlides}\n\n──────────────────────────────────\nSTATIC POST TIPS\n──────────────────────────────────\n• Generate each slide as a separate image with ${aiLabel}\n• Keep visual style consistent across all slides (same tone/lighting)\n• Add text overlays (hook, benefit, CTA) in your editing app after generating\n• Export at native resolution for ${ratio}`,
      caption,
    };
  }

  return {
    image: baseImage,
    introVideo: isKling
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nINTRO VIDEO PROMPT — SCENE 0 (HOOK)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🎬 KLING PROMPT — Shot A:\n${product} lifted toward camera from below, handheld arm shake, natural window light, UGC\n\n🎬 KLING PROMPT — Shot B:\nclose-up product held toward lens, fingers visible, autofocus lock, warm ambient light, smartphone POV\n\n❌ NEGATIVE: ${NEG_SHORT}`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nINTRO VIDEO PROMPT — SCENE 0 (HOOK)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n\`\`\`\n[0:00-0:04] Handheld smartphone POV — camera starts half-hidden, then ${product} is slowly lifted toward the lens from below frame. Natural window light. Organic movement, slight shake. Real room or table background.\n\n[0:04-0:08] Camera slowly zooms in on ${product} — hand maintains hold, fingers visible. Autofocus hunts briefly then locks. ${visualStyle}.\n\`\`\`\n\n❌ NEGATIVE PROMPT:\nno talking, no speaking, no open mouth, no mouth movement, no dialogue, no lip sync, no lip movement — IF any male or female model appears: model must NOT speak or open mouth at all, completely silent; no smiling at camera, no posing, no looking directly at camera, no influencer pose, no fake reaction, no studio lighting, no tripod, no watermark\n\n💡 Intro Tips:\n• Ideal intro duration: 2–4 seconds\n• Goal: stop the scroll within the first second\n• Always start with movement — not a static product shot\n• Use visual curiosity rather than text hooks`,
    video: `══════════════════════════════════\n🎯 MASTER PROMPT — ${contentLabel.toUpperCase()}\n══════════════════════════════════\n${isKling ? "\n⚠️  KLING MODE — All video prompts are compressed to max 40 words per shot. No timestamps. Paste each shot directly into Kling's prompt field.\n" : ""}\nPRODUCT   : ${product}\nBENEFIT   : ${benefit}\nNICHE     : ${nicheLabel}\nPLATFORM  : ${platformLabel} (${ratio} | ${duration})\nTONE      : ${toneLabel}\nAI TOOL   : ${aiLabel}\nSTYLE     : Handheld Smartphone / Natural UGC\n\n──────────────────────────────────\nSHOT-BY-SHOT SEQUENCE\n──────────────────────────────────\n\n${shotList}\n\n──────────────────────────────────\nAI SETTINGS\n──────────────────────────────────\n${aiNote}\n\n──────────────────────────────────\nSMARTPHONE UGC TIPS\n──────────────────────────────────\n• Always add: "handheld", "shot on smartphone", "natural light" to every prompt\n• Avoid: "cinematic", "studio lighting", "dolly shot", "professional"\n• Use natural indoor/outdoor backgrounds — not plain backdrops\n• Let framing be slightly tilted or imperfect — that's what makes content feel real\n• Export final at native platform resolution (${ratio})`,
    caption,
  };
}

function getMediaType(b64) {
  const sig = b64.substring(0, 16);
  if (sig.startsWith("/9j")) return "image/jpeg";
  if (sig.startsWith("iVBOR")) return "image/png";
  if (sig.startsWith("R0lGO")) return "image/gif";
  if (sig.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

async function buildAIPrompt({ imgB64, niche, fashionSub, platform, contentType, aiGen, tone, productName, productBenefit }) {
  const nicheObj    = NICHES.find(n => n.id === niche);
  const platformObj = PLATFORMS.find(p => p.id === platform);
  const toneObj     = TONES.find(t => t.id === tone);
  const aiObj       = AI_GENERATORS.find(a => a.id === aiGen);
  const contentObj  = CONTENT_TYPES.find(c => c.id === contentType);

  const isKlingAI  = aiObj?.id === "kling";
  const isStaticAI = STATIC_PLATFORM_IDS.includes(platform); 

  const klingIntroFormat = isKlingAI
    ? "🎬 KLING PROMPT — Shot A:\n[max 40 words — product reveal action, handheld, natural light, UGC keywords]\n\n🎬 KLING PROMPT — Shot B:\n[max 40 words — close-up or hold, autofocus lock, warm light, smartphone POV]\n\n❌ NEGATIVE: no speech, no open mouth, no lip movement, no text, no studio light, no tripod, no gimbal"
    : "```\n[0:00-0:04] [handheld action that grabs attention — product reveal from below frame, hand motion, or dramatic lift toward camera. Natural light. Organic shake. No text overlay.]\n\n[0:04-0:08] [continuation — autofocus lock, slight zoom, hold on product]\n```\n\n❌ NEGATIVE PROMPT:\nno talking, no speaking, no mouth movement, no dialogue, no lip sync, no smiling at camera, no posing, no looking directly at camera, no influencer pose, no fake reaction, no studio lighting, no tripod, no watermark\n\n💡 Intro Tips:\n• Ideal intro duration: 2–4 seconds\n• Goal: stop the scroll within the first second\n• Always start with movement — not a static product shot\n• Use visual curiosity rather than text hooks";

  const klingModeRules = isKlingAI
    ? "\n\n⚠️ KLING AI MODE — STRICT RULES:\n- Each sub-shot prompt must be MAX 40 WORDS — Kling rejects long prompts\n- NO timestamps (no [0:00-0:03] etc) — Kling ignores them and they waste token budget\n- NO narrative sentences — use comma-separated visual keywords only\n- Format each shot as: \"[subject] [action], [camera], [lighting], [style keywords]\"\n- Example good Kling prompt: \"woman in pink knit pants lowers phone from face to waist, selfie cam, arm shake, natural window light, UGC\"\n- Example bad (too long): \"The model holds her smartphone at arm's length and gradually lowers it while the ribbed texture of her pants catches the warm golden light filtering through the window...\"\n- After each scene's 2 shots, add: ❌ NEGATIVE: no speech, no open mouth, no lip movement, no text, no studio light, no tripod, no gimbal"
    : "";

  const klingSceneFormat = isKlingAI
    ? "🖼️ IMAGE ANCHOR (upload to Kling):\n[image prompt]\n\n🎬 KLING PROMPT — Shot A:\n[max 40 words, no timestamp, visual keywords only]\n\n🎬 KLING PROMPT — Shot B:\n[max 40 words, no timestamp, visual keywords only]\n\n❌ NEGATIVE: no speech, no open mouth, no lip movement, no text, no studio light, no tripod, no gimbal"
    : "🖼️ IMAGE ANCHOR:\n[One-sentence photorealistic image prompt. Include: exact product details, setting, \"shot on smartphone\", \"handheld\", \"natural ambient lighting\", \"UGC aesthetic\", \"--ar " + safeArRatio(platformObj?.ratio) + " --style raw --v 6.1\"]\n\n```\n[0:00-0:04] [sub-shot A description with camera movement]\n\n[0:04-0:08] [sub-shot B description with camera movement]\n```";

  const klingRules = isKlingAI
    ? "- Each scene has: 🖼️ IMAGE ANCHOR + 🎬 KLING PROMPT — Shot A + 🎬 KLING PROMPT — Shot B + ❌ NEGATIVE\n- Shot A and Shot B MUST be labeled exactly as \"🎬 KLING PROMPT — Shot A:\" and \"🎬 KLING PROMPT — Shot B:\"\n- Each shot: MAX 40 WORDS, no timestamps, comma-separated visual keywords only\n- After Shot B, always add: ❌ NEGATIVE: no speech, no open mouth, no lip movement, no text, no studio light, no tripod, no gimbal"
    : "- Each scene has 1 Image Anchor + 2 sub-shots inside triple backticks\n- After the closing triple backtick of each scene, add the ❌ NEGATIVE PROMPT block\n- Each scene is exactly 8 seconds total: Shot A timestamp is always [0:00-0:04], Shot B is always [0:04-0:08] — timestamps ALWAYS reset to 0:00 at the start of every new scene, never continue from previous scene\n- Every sub-shot must include: \"handheld\", \"natural light\", \"smartphone POV\" or \"selfie cam\"";

  const fashionSubRules = niche === "fashion" && fashionSub === "clothing"
    ? "- THIS IS A CLOTHING PRODUCT — use this EXACT 4-scene structure:\n  SCENE 1 — INTRO (clothing on table): Image: garment flat-lay on table/bed. Video: slow side-to-side camera pan across garment, natural window light, handheld, no model.\n  SCENE 2 — MODEL SELF-RECORDING: Image: person wearing garment holding phone at arm's length recording themselves (selfie-style). Video: model holds smartphone toward their own body at arm's length — self-filming POV. Phone arm slightly unstable, natural shake. Model lowers phone from face to waist revealing outfit. Does NOT speak.\n  SCENE 3 — OUTDOOR WIDE STATIC SHOT: Image: full-body wide shot of person wearing garment outdoors, camera completely stationary. Video: STATIC CAMERA — locked off, zero movement, no pan, no tilt. Wide shot shows full outfit head to toe. Model moves naturally within frame (walking, turning). Camera stays completely still.\n  SCENE 4 — CANDID WIDE STATIC: Image: wide static candid full-body shot of person wearing garment in natural setting. Video: STATIC CAMERA — fully locked off, no movement whatsoever. Wide angle captures full outfit. Model moves naturally within frame. Camera does not move at all."
    : niche === "fashion" && fashionSub === "fabric"
    ? "- THIS IS RAW FABRIC / UNSEWN MATERIAL — it is NOT a finished garment. NEVER show a model wearing it, NEVER describe it as a dress/kebaya/shirt/outfit. Use this EXACT 4-scene structure (fabric only, no sewn shape, no human wearing it):\n  SCENE 1 — INTRO (flat-lay): Image: fabric fully unfolded, flat-lay on table/floor showing full print. Video: slow pan across the flat fabric, natural light, handheld, no model, no garment shape.\n  SCENE 2 — TEXTURE & WEAVE DETAIL: Image: macro close-up of weave/print/texture, fingers touching the fabric. Video: fingers gently rub the fabric to show quality, then lift and lightly drape it over a hand to show natural flow.\n  SCENE 3 — DRAPE / HANGING REVEAL: Image: hand holding top edge, fabric hanging freely downward showing full pattern. Video: fabric hangs and sways naturally, camera pans down its length — this is a piece of cloth, not a piece of clothing.\n  SCENE 4 — WIDTH / LENGTH DEMONSTRATION: Image: two hands stretching fabric wide to show full width and pattern repeat. Video: fabric stretched wide, then folded back neatly for a final flat-lay hero shot."
    : niche === "fashion" && fashionSub === "bag"
    ? "- THIS IS A BAG/ACCESSORIES PRODUCT — use this EXACT 4-scene structure (NO human model needed, hands only):\n  SCENE 1 — INTRO (bag on table): Image: bag placed on table/marble surface showing front face. Video: slow side-to-side camera pan in front of the bag, then close-up on hardware/zipper detail.\n  SCENE 2 — HARDWARE & ZIPPER DETAIL: Image: extreme macro of zipper pull, metal clasp, stitching, logo embossing. Video: finger taps hardware, hand slowly pulls zipper open revealing quality from close-up.\n  SCENE 3 — EXTERIOR REVEAL (hand lift): Image: hand lifting/holding bag toward camera. Video: hand lifts bag from below frame, rotates 90° to show all sides front/back/bottom.\n  SCENE 4 — INTERIOR REVEAL: Image: bag opened wide toward camera showing interior compartments and lining. Video: hand opens bag toward camera revealing interior, then pull out to full exterior hero shot."
    : niche !== "fashion"
    ? "- For fashion/bag products: hand lifting toward camera, finger tapping hardware, macro on stitching/zipper, interior reveal POV"
    : "";

  const totalScenes = niche === "fashion" ? "4" : "5";
  const klingIntroNote = isKlingAI ? " ⚠️ KLING MODE: Use Shot A / Shot B labels. Max 40 words each. No timestamps. Keywords only." : "";

  const system = `You are a professional UGC and affiliate content strategist specializing in authentic smartphone-shot content.
User settings:
- Niche: ${nicheObj?.label}
- Platform: ${platformObj?.label} (${platformObj?.ratio}, ${platformObj?.duration})
- Content type: ${contentObj?.label}
- Tone: ${toneObj?.label} — ${toneObj?.style}
- AI Generator: ${aiObj?.label}
- Product name: ${productName || "from image"}
- Key benefit: ${productBenefit || "from image"}

CRITICAL STYLE RULE: All prompts must look like they were filmed on a smartphone by a real person — NOT a professional production. Use these characteristics throughout:
- Handheld camera with natural sway and subtle shake
- Slightly imperfect framing and organic composition
- Natural ambient light (window, room light, golden hour) — no ring lights or studio setups
- Occasional autofocus hunting for authenticity
- POV / first-person angles (own hand holding product toward camera)
- Selfie-mode shots for reactions
- Real-life backgrounds (bedroom, desk, kitchen) not studio sets
- No gimbal stabilization — organic motion is key

Analyze the product photo carefully. Note: exact color, material finish, hardware color, design features, accessories/charms, stitching, handle style, size impression.

CRITICAL CONSISTENCY RULE (mandatory): Because each image/video prompt below will be generated as a SEPARATE, INDEPENDENT AI call (the generator has no memory of other scenes), you must repeat the exact same product visual details — color, material, distinguishing features noted above — in EVERY single scene/slide prompt, not just the first one. Never rely on the product name alone to imply visual continuity; spell out the specific color/material/feature words every time so the product looks identical across all generated shots.

CLAIM SAFETY RULE (mandatory for CAPTION and any benefit-related text):
- Never use absolute, medical, or guaranteed-outcome language: "cures", "heals", "eliminates", "guaranteed", "instant results", "100% effective", "clinically proven" — these trigger ad account bans on Meta, TikTok, and Google Ads, and can violate consumer-protection rules.
- Especially for Health & Wellness and Beauty & Skincare niches: phrase benefits as personal experience ("I noticed", "felt so much softer", "my skin looked more even") rather than clinical claims.
- If the user-provided benefit text already contains an absolute claim, soften it into experiential language instead of copying it verbatim.

DISCLOSURE RULE (mandatory for CAPTION output — this is an affiliate marketing tool):
- The caption's very first line, before the hook, must be a clear disclosure: "✨ Affiliate/Paid Partnership" or "#ad" on its own line — this is a legal requirement for affiliate and sponsored content in most jurisdictions (e.g. FTC in the US, similar consumer-protection rules elsewhere).
- Do not bury the disclosure only inside the hashtag list at the end — it must appear at the very start where it is clearly visible before the viewer engages with the content.

NEGATIVE PROMPT RULE (mandatory for ALL video outputs):
Every video prompt (intro and all scenes) must end with this block:

❌ NEGATIVE PROMPT:
no talking, no speaking, no open mouth, no mouth movement, no dialogue, no lip sync, no lip movement, no voiceover, no subtitles, no text on screen, no smiling directly at camera, no posing, no staged expression, no looking at camera and smiling, no influencer pose, no fake laugh, no exaggerated reaction, no professional model behavior, no studio lighting, no tripod, no gimbal, no stabilized footage, no green screen, no CGI background, no watermark, no logo — MODEL RULE (CRITICAL): if any male or female model/human appears in any frame, that model must NEVER speak, NEVER open their mouth, NEVER show any lip movement, and must remain completely silent throughout the entire video; zero dialogue, zero verbal communication from any human in frame

Generate FOUR outputs:

1. IMAGE_PROMPT (English, 80-120 words): Photorealistic AI image prompt for ${aiObj?.label}. Must include: "shot on smartphone", "handheld", "natural ambient lighting", "UGC aesthetic", "slightly imperfect framing". Include exact product description from photo, real-life setting matching the tone (bedroom desk, kitchen counter, café table — not studio), aspect ratio ${platformObj?.ratio}.
${isStaticAI ? `
2. INTRO_VIDEO_PROMPT (English): ${platformObj?.label} is a STATIC platform (photo/carousel) — there is no video here. Just write one short line: "ℹ️ ${platformObj?.label} is a static format — no video needed. See the slide-by-slide carousel breakdown below." followed by a one-sentence description of what Slide 1 (the cover/hook slide) should look like.

3. VIDEO_PROMPT (English): This is actually a CAROUSEL_SLIDES output, NOT a video. Structure as 5 SLIDES, each ONE photorealistic image prompt (no timestamps, no camera movement, no video language). Format strictly as follows:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE [N] — [LABEL]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖼️ IMAGE PROMPT:
[One photorealistic image prompt. Must include "shot on smartphone", "natural ambient lighting", "UGC aesthetic", exact product details, "--ar ${safeArRatio(platformObj?.ratio)} --style raw --v 6.1"]

Rules for the 5 slides:
- SLIDE 1 — HOOK/COVER: eye-catching hero shot of the product, leave visual space for a headline
- SLIDE 2 — PRODUCT DETAIL: macro/close-up of texture or key feature
- SLIDE 3 — IN USE / CONTEXT: product shown in a real everyday setting
- SLIDE 4 — BENEFIT / RESULT: visual proof of the key benefit "${productBenefit || "from image"}"
- SLIDE 5 �� CTA: clean shot with negative space for a "link in bio" text overlay
${fashionSubRules}
- NO video language: no timestamps, no "camera pans", no "handheld shake" — these are static photos
- NO professional terms: no "studio lighting", "commercial photography"
` : `
2. INTRO_VIDEO_PROMPT (English): A short 2–4 second intro/hook sequence.${klingIntroNote} Structure:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTRO VIDEO PROMPT — SCENE 0 (HOOK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${klingIntroFormat}

3. VIDEO_PROMPT (English): Structure as SCENES. Each scene has exactly 2 sub-shots.${klingModeRules} Format strictly as follows (repeat for all ${totalScenes} scenes):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCENE [N] — [LABEL]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${klingSceneFormat}

Rules for VIDEO_PROMPT:
- Total ${totalScenes} scenes covering ${platformObj?.duration}
${klingRules}
- CRITICAL MODEL RULE: If any male or female human model appears in any scene, they must be completely silent — no open mouth, no lip movement, no talking, no dialogue whatsoever. Describe models as doing physical actions only — never speaking or reacting verbally.
${fashionSubRules}
- NO professional terms: no "dolly", "crane shot", "studio lighting", "gimbal"
- Autofocus hunting, slight shake, imperfect framing = authenticity markers to include
`}
4. CAPTION (English): Ready-to-post. Start with the disclosure line required by DISCLOSURE RULE above, then a relatable hook, 3 bullet benefits with checkmarks (following CLAIM SAFETY RULE above), CTA "link in bio", relevant hashtags. Conversational and authentic, not stiff.

Respond ONLY as valid JSON (no markdown, no extra text):
{"image":"...","introVideo":"...","video":"...","caption":"..."}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);

  let resp;
  try {
    resp = await fetch("/api/generate-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, imgB64, mediaType: getMediaType(imgB64) }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out after 55 seconds. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  let data;
  try {
    data = await resp.json();
  } catch {
    throw new Error(`Server returned an unreadable response (HTTP ${resp.status}). Please try again.`);
  }

  if (!resp.ok) {
    throw new Error(data?.error?.message || `Request failed (HTTP ${resp.status}). Please try again.`);
  }
  if (data.error) throw new Error(data.error.message || "API error");

  const raw = data.content.map(b => b.text || "").join("");
  let clean = raw.replace(/```json|```/g, "").trim();

  const start = clean.indexOf("{");
  let end = clean.lastIndexOf("}");
  if (start === -1) throw new Error("No JSON found in AI response.");
  if (end === -1) {
    clean = clean.slice(start);
    let inStr = false, escaped = false;
    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') inStr = !inStr;
    }
    if (inStr) clean += '"';
    clean += "}";
    end = clean.length - 1;
  }
  clean = clean.slice(start, end + 1);

  try {
    return JSON.parse(clean);
  } catch (e) {
    const extract = (key) => {
      const rx = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)"`, "s");
      const m  = clean.match(rx);
      return m ? m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : `[Failed to parse field: ${key}]`;
    };
    return {
      image:      extract("image"),
      introVideo: extract("introVideo"),
      video:      extract("video"),
      caption:    extract("caption"),
    };
  }
}

const gold  = "#c8a060";
const gold2 = "#e8b840";
const dark  = "#0a0a0f";

export default function App() {
  const [step,      setStep]      = useState(0);
  const [imgB64,    setImgB64]    = useState(null);
  const [imgSrc,    setImgSrc]    = useState(null);
  const [isDrag,    setIsDrag]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [activeTab, setActiveTab] = useState("image");
  const [copied,    setCopied]    = useState("");
  const EMPTY_FORM = { niche:"", fashionSub:"", platform:"", contentType:"", aiGen:"", tone:"", productName:"", productBenefit:"" };
  const [form,      setForm]      = useState(() => {
    try {
      const saved = localStorage.getItem(FORM_STORAGE_KEY);
      return saved ? { ...EMPTY_FORM, ...JSON.parse(saved) } : EMPTY_FORM;
    } catch {
      return EMPTY_FORM;
    }
  });
  const [restoredDraft, setRestoredDraft] = useState(() => {
    try { return !!localStorage.getItem(FORM_STORAGE_KEY); } catch { return false; }
  });

  useEffect(() => {
    try {
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form));
    } catch {
      // ignore storage issues
    }
  }, [form]);

  const [fileError, setFileError] = useState("");
  const fileRef = useRef();

  const MAX_FILE_MB = 8;
  const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const handleFile = file => {
    setFileError("");
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError("Unsupported file type. Please upload a JPG, PNG, WEBP, or GIF image.");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`Image is too large (${(file.size / (1024*1024)).toFixed(1)}MB). Please use an image under ${MAX_FILE_MB}MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setFileError("Couldn't read that file. Please try a different image.");
    reader.onload = ev => {
      const url = ev.target.result;
      setImgSrc(url);
      setImgB64(url.split(",")[1]);
      setStep(1);
    };
    reader.readAsDataURL(file);
  };

  const isFashion = form.niche === "fashion";

  const canNext = () => {
    if (step === 1) return !!form.niche;
    if (step === 2) return isFashion ? !!form.fashionSub : !!form.platform;
    if (step === 3) return isFashion ? !!form.platform : !!form.contentType;
    if (step === 4) return !!form.aiGen;
    if (step === 5) return !!form.tone;
    if (step === 6) return !!imgB64 || form.productName.trim().length > 0;
    return true;
  };

  const LAST_STEP = 7;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const prompts = imgB64
        ? await buildAIPrompt({ imgB64, ...form })
        : buildStaticPrompt(form);
      setResult(prompts);
      setActiveTab("intro");
    } catch (err) {
      const isNetworkError = err instanceof TypeError;
      const reason = isNetworkError
        ? "Could not reach the AI service (network/connection issue)."
        : (err.message || "Unknown error.");
      const msg = `⚠️ Generate failed.\n\n${reason}\n\nClick "New Prompt" and try again${imgB64 ? ", or retry without the photo" : ""}.`;
      setResult({ image: msg, introVideo: msg, video: msg, caption: msg });
    }
    setLoading(false);
  };

  const reset = () => {
    setStep(0); setImgB64(null); setImgSrc(null); setResult(null); setLoading(false); setFileError("");
    setForm(EMPTY_FORM);
    setRestoredDraft(false);
    try { localStorage.removeItem(FORM_STORAGE_KEY); } catch {}
    if (fileRef.current) fileRef.current.value = "";
  };

  const nextStep = () => {
    if (step === LAST_STEP) { handleGenerate(); return; }
    setStep(s => s + 1);
  };

  const appStyle = {
    minHeight:"100vh",
    background:`linear-gradient(160deg, ${dark} 0%, #111118 60%, #0d1020 100%)`,
    fontFamily:"'Georgia',serif", color:"#e8e0d0",
    display:"flex", flexDirection:"column", alignItems:"center",
  };

  const headerStyle = {
    width:"100%", background:"linear-gradient(90deg,#12101a,#0d1525)",
    borderBottom:"1px solid rgba(255,200,100,0.12)",
    padding:"24px 20px 18px", textAlign:"center",
  };

  const bodyStyle = { width:"100%", maxWidth:620, padding:"0 18px 48px" };

  if (loading) return (
    <div style={appStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize:10, letterSpacing:6, color:gold, textTransform:"uppercase", marginBottom:8 }}>AI Content Studio</div>
        <h1 style={{ margin:0, fontSize:"clamp(20px,5vw,32px)", background:`linear-gradient(135deg,#f0c060,#e0a040,#c0784a)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", fontWeight:"400", letterSpacing:2 }}>Affiliate & UGC Prompt Generator</h1>
      </div>
      <div style={{ ...bodyStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingTop:80, gap:20 }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width:40, height:40, border:"2px solid rgba(200,160,80,0.3)", borderTopColor:gold, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
        <div style={{ fontSize:13, color:"#8899aa", letterSpacing:2, textTransform:"uppercase" }}>
          {imgB64 ? "Analyzing product with AI..." : "Building prompt..."}
        </div>
      </div>
    </div>
  );

  if (result) {
    const isStaticPlatform = STATIC_PLATFORM_IDS.includes(form.platform);
    const tabs = [
      { key:"intro", label: isStaticPlatform ? "Cover" : "Intro" },
      { key:"video", label: isStaticPlatform ? "Carousel Slides" : "Video Prompt" },
      { key:"caption", label:"Caption" },
    ];

    const introContent =
      `🖼️ IMAGE PROMPT\n${"─".repeat(36)}\n${result.image || ""}\n\n` +
      `${isStaticPlatform ? "ℹ️ NOTE" : "🎬 INTRO VIDEO PROMPT"}\n${"─".repeat(36)}\n${result.introVideo || ""}`;

    const displayContent = activeTab === "intro" ? introContent : result[activeTab];
    const copyContent = activeTab === "intro" ? introContent : result[activeTab];

    return (
      <div style={appStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize:10, letterSpacing:6, color:gold, textTransform:"uppercase", marginBottom:8 }}>AI Content Studio</div>
          <h1 style={{ margin:0, fontSize:"clamp(20px,5vw,32px)", background:`linear-gradient(135deg,#f0c060,#e0a040,#c0784a)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", fontWeight:"400", letterSpacing:2 }}>Affiliate & UGC Prompt Generator</h1>
          <p style={{ margin:"6px 0 0", fontSize:11, color:"#8899aa", letterSpacing:1 }}>Ready-to-use output</p>
        </div>
        <div style={bodyStyle}>
          {imgSrc && (
            <div style={{ marginTop:20, borderRadius:10, overflow:"hidden", border:"1px solid rgba(255,255,255,0.08)", maxHeight:180 }}>
              <img src={imgSrc} alt="product" style={{ width:"100%", objectFit:"cover", display:"block", maxHeight:180 }} />
            </div>
          )}
          <div style={{ display:"flex", gap:8, marginTop:18 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                flex:1, padding:"9px 4px", borderRadius:8, cursor:"pointer", fontSize:12, letterSpacing:1,
                border: activeTab===t.key ? `1px solid rgba(200,160,80,0.5)` : "1px solid rgba(255,255,255,0.08)",
                background: activeTab===t.key ? "rgba(200,160,80,0.12)" : "rgba(255,255,255,0.03)",
                color: activeTab===t.key ? gold : "#8899aa",
                fontFamily:"inherit", transition:"all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>

          {activeTab === "intro" ? (
            <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ position:"relative" }}>
                <div style={{ fontSize:10, letterSpacing:3, color:gold, textTransform:"uppercase", marginBottom:6 }}>🖼️ Image Prompt</div>
                <pre style={{
                  background:"rgba(0,0,0,0.35)", border:"1px solid rgba(200,160,80,0.12)",
                  borderRadius:12, padding:"14px 14px 48px", fontSize:12, lineHeight:1.75,
                  color:"#d0c8b0", whiteSpace:"pre-wrap", wordBreak:"break-word",
                  fontFamily:"'Courier New',monospace", maxHeight:"28vh", overflowY:"auto", margin:0,
                }}>{result.image || ""}</pre>
                <button onClick={() => { navigator.clipboard.writeText(result.image||""); setCopied("img"); setTimeout(()=>setCopied(""),2000); }} style={{
                  position:"absolute", bottom:12, right:12,
                  padding:"5px 14px", borderRadius:6, cursor:"pointer",
                  background: copied==="img" ? "rgba(100,200,100,0.2)" : "rgba(200,160,80,0.15)",
                  border: `1px solid ${copied==="img" ? "rgba(100,200,100,0.4)" : "rgba(200,160,80,0.3)"}`,
                  color: copied==="img" ? "#88ee88" : gold, fontSize:11, letterSpacing:1, fontFamily:"inherit",
                }}>{copied==="img" ? "✓ Copied" : "Copy"}</button>
              </div>

              <div style={{ position:"relative" }}>
                <div style={{ fontSize:10, letterSpacing:3, color:gold, textTransform:"uppercase", marginBottom:6 }}>{isStaticPlatform ? "ℹ️ Note" : "🎬 Intro Video Prompt"}</div>
                <pre style={{
                  background:"rgba(0,0,0,0.35)", border:"1px solid rgba(200,160,80,0.12)",
                  borderRadius:12, padding:"14px 14px 48px", fontSize:12, lineHeight:1.75,
                  color:"#d0c8b0", whiteSpace:"pre-wrap", wordBreak:"break-word",
                  fontFamily:"'Courier New',monospace", maxHeight:"28vh", overflowY:"auto", margin:0,
                }}>{result.introVideo || ""}</pre>
                <button onClick={() => { navigator.clipboard.writeText(result.introVideo||""); setCopied("ivid"); setTimeout(()=>setCopied(""),2000); }} style={{
                  position:"absolute", bottom:12, right:12,
                  padding:"5px 14px", borderRadius:6, cursor:"pointer",
                  background: copied==="ivid" ? "rgba(100,200,100,0.2)" : "rgba(200,160,80,0.15)",
                  border: `1px solid ${copied==="ivid" ? "rgba(100,200,100,0.4)" : "rgba(200,160,80,0.3)"}`,
                  color: copied==="ivid" ? "#88ee88" : gold, fontSize:11, letterSpacing:1, fontFamily:"inherit",
                }}>{copied==="ivid" ? "✓ Copied" : "Copy"}</button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop:10, position:"relative" }}>
              <pre style={{
                background:"rgba(0,0,0,0.35)", border:"1px solid rgba(200,160,80,0.12)",
                borderRadius:12, padding:"16px 16px 52px", fontSize:12, lineHeight:1.75,
                color:"#d0c8b0", whiteSpace:"pre-wrap", wordBreak:"break-word",
                fontFamily:"'Courier New',monospace", maxHeight:"55vh", overflowY:"auto", margin:0,
              }}>{displayContent}</pre>
              <button onClick={() => { navigator.clipboard.writeText(copyContent); setCopied(activeTab); setTimeout(()=>setCopied(""),2000); }} style={{
                position:"absolute", bottom:12, right:12,
                padding:"6px 16px", borderRadius:6, cursor:"pointer",
                background: copied===activeTab ? "rgba(100,200,100,0.2)" : "rgba(200,160,80,0.15)",
                border: `1px solid ${copied===activeTab ? "rgba(100,200,100,0.4)" : "rgba(200,160,80,0.3)"}`,
                color: copied===activeTab ? "#88ee88" : gold, fontSize:11, letterSpacing:1, fontFamily:"inherit",
              }}>{copied===activeTab ? "✓ Copied" : "Copy"}</button>
            </div>
          )}

          <button onClick={reset} style={{
            marginTop:14, width:"100%", padding:"12px", borderRadius:10,
            background:"transparent", border:"1px solid rgba(255,255,255,0.1)",
            color:"#8899aa", cursor:"pointer", fontSize:13, letterSpacing:1, fontFamily:"inherit",
          }}>↺ New Prompt</button>
        </div>
      </div>
    );
  }

  return (
    <div style={appStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize:10, letterSpacing:6, color:gold, textTransform:"uppercase", marginBottom:8 }}>AI Content Studio</div>
        <h1 style={{ margin:0, fontSize:"clamp(20px,5vw,32px)", background:`linear-gradient(135deg,#f0c060,#e0a040,#c0784a)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", fontWeight:"400", letterSpacing:2 }}>Affiliate & UGC Prompt Generator</h1>
        <p style={{ margin:"6px 0 0", fontSize:11, color:"#8899aa", letterSpacing:1 }}>Multi-platform · AI-powered · Ready to use</p>
      </div>

      <div style={{ width:"100%", maxWidth:620, padding:"16px 18px 0" }}>
        <div style={{ display:"flex", gap:3 }}>
          {(isFashion ? STEP_LABELS_FASHION : STEP_LABELS_NONFASHION).map((label,i) => (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <div style={{ height:2.5, width:"100%", borderRadius:2, background: i<=step ? `linear-gradient(90deg,${gold},${gold2})` : "rgba(255,255,255,0.07)", transition:"all 0.3s" }} />
              <span style={{ fontSize:8, color: i===step ? gold : "#334455", letterSpacing:1, textTransform:"uppercase" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={bodyStyle}>
        {step === 0 && (
          <Sec title="Upload Product Photo" sub="Optional — AI will auto-analyze product details">
            {restoredDraft && (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, color:"#e0b060", padding:"8px 12px", borderRadius:8, background:"rgba(200,160,80,0.08)", border:"1px solid rgba(200,160,80,0.2)" }}>
                <span>📝 Draft sebelumnya dipulihkan (foto tidak ikut tersimpan).</span>
                <button onClick={reset} style={{ background:"none", border:"none", color:"#e0b060", textDecoration:"underline", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>Hapus draft</button>
              </div>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" ref={fileRef} style={{ display:"none" }}
              onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
            <div
              onClick={() => fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
              onDragLeave={() => setIsDrag(false)}
              onDrop={e => { e.preventDefault(); setIsDrag(false); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
              style={{
                border:`1.5px dashed ${isDrag ? gold : "rgba(200,160,80,0.25)"}`,
                borderRadius:12, padding:"40px 20px", textAlign:"center", cursor:"pointer",
                background: isDrag ? "rgba(200,160,80,0.06)" : "rgba(255,255,255,0.02)",
                transition:"all 0.2s",
              }}>
              <div style={{ fontSize:32, marginBottom:10 }}>📷</div>
              <div style={{ fontSize:15, color:gold, marginBottom:6 }}>Tap or drag product photo here</div>
              <div style={{ fontSize:12, color:"#445566" }}>JPG · PNG · WEBP · GIF, max {MAX_FILE_MB}MB — AI reads product details automatically</div>
            </div>
            {fileError && (
              <div style={{ fontSize:12, color:"#ff8080", padding:"8px 12px", borderRadius:8, background:"rgba(200,60,60,0.08)", border:"1px solid rgba(200,60,60,0.25)" }}>⚠️ {fileError}</div>
            )}
            <div onClick={() => setStep(1)} style={{
              textAlign:"center", padding:"14px", borderRadius:10,
              border:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.02)",
              cursor:"pointer", color:"#667788", fontSize:13, letterSpacing:1,
            }}>Skip — enter product name manually →</div>
          </Sec>
        )}

        {step === 1 && (
          <Sec title="Select Niche" sub="Category of product being promoted">
            {imgSrc && <ThumbImg src={imgSrc} />}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {NICHES.map(n => (
                <div key={n.id} onClick={() => set("niche",n.id)}
                  role="button" tabIndex={0} aria-pressed={form.niche===n.id} aria-label={n.label}
                  onKeyDown={e => { if (e.key==="Enter"||e.key===" ") { e.preventDefault(); set("niche",n.id); } }}
                  style={{
                  display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", gap:6,
                  padding:"16px 10px", borderRadius:12, cursor:"pointer",
                  border: form.niche===n.id ? `1px solid ${n.color}` : "1px solid rgba(255,255,255,0.07)",
                  background: form.niche===n.id ? "rgba(200,160,80,0.09)" : "rgba(255,255,255,0.02)",
                  transition:"all 0.17s ease",
                }}>
                  <span style={{ fontSize:24 }}>{n.emoji}</span>
                  <span style={{ fontSize:13, fontWeight:500, color: form.niche===n.id ? "#f0e0c0" : "#ccc" }}>{n.label}</span>
                </div>
              ))}
            </div>
          </Sec>
        )}

        {step === 2 && isFashion && (
          <Sec title="Fashion Product Type" sub="Select the specific product category">
            {imgSrc && <ThumbImg src={imgSrc} />}
            {FASHION_SUBCATEGORIES.map(s => (
              <Card key={s.id} selected={form.fashionSub===s.id} onClick={() => set("fashionSub", s.id)} accent="#b5c9f7">
                <span style={{ fontSize:26 }}>{s.emoji}</span>
                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  <span style={{ fontSize:15, fontWeight:500 }}>{s.label}</span>
                  <span style={{ fontSize:11, color:"#8899aa" }}>{s.desc}</span>
                </div>
              </Card>
            ))}
          </Sec>
        )}

        {((isFashion && step === 3) || (!isFashion && step === 2)) && (
          <Sec title="Target Platform" sub="Where will this content be published?">
            {PLATFORMS.map(p => (
              <Card key={p.id} selected={form.platform===p.id} onClick={() => set("platform",p.id)}>
                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  <span style={{ fontSize:15, fontWeight:500 }}>{p.label}</span>
                  <span style={{ fontSize:11, color:"#8899aa" }}>{p.ratio} · {p.duration}</span>
                </div>
              </Card>
            ))}
          </Sec>
        )}

        {(!isFashion && step === 3) && (
          <Sec title="Content Type" sub="Storytelling format for the video">
            {CONTENT_TYPES.map(c => (
              <Card key={c.id} selected={form.contentType===c.id} onClick={() => set("contentType",c.id)}>
                <span style={{ fontSize:22 }}>{c.icon}</span>
                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  <span style={{ fontSize:15, fontWeight:500 }}>{c.label}</span>
                  <span style={{ fontSize:11, color:"#8899aa" }}>{c.desc}</span>
                </div>
              </Card>
            ))}
          </Sec>
        )}

        {step === 4 && (
          <Sec title="AI Generator" sub="Which AI tool will you be using?">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {AI_GENERATORS.map(a => (
                <div key={a.id} onClick={() => set("aiGen",a.id)} style={{
                  padding:"14px", borderRadius:10, cursor:"pointer",
                  border: form.aiGen===a.id ? `1px solid ${gold}` : "1px solid rgba(255,255,255,0.07)",
                  background: form.aiGen===a.id ? "rgba(200,160,80,0.1)" : "rgba(255,255,255,0.02)",
                  transition:"all 0.18s",
                }}>
                  <div style={{ fontSize:13, fontWeight:500, color: form.aiGen===a.id?"#e8c070":"#ccc", marginBottom:4 }}>{a.label}</div>
                  <div style={{ fontSize:10, letterSpacing:1, textTransform:"uppercase",
                    color: a.type==="video"?"#88bbff":a.type==="image"?"#ff99cc":"#aaccaa" }}>
                    {a.type==="both"?"Video & Image":a.type}
                  </div>
                </div>
              ))}
            </div>
          </Sec>
        )}

        {step === 5 && (
          <Sec title="Tone & Vibe" sub="Visual character and content narrative">
            {TONES.map(t => (
              <Card key={t.id} selected={form.tone===t.id} onClick={() => set("tone",t.id)}>
                <span style={{ fontSize:15, fontWeight:500 }}>{t.label}</span>
              </Card>
            ))}
          </Sec>
        )}

        {step === 6 && (
          <Sec title="Product Info" sub="Specific details of the product being promoted">
            {imgSrc && <ThumbImg src={imgSrc} />}
            {imgSrc && <div style={{ fontSize:12, color:"#55aa77", padding:"8px 12px", borderRadius:8, background:"rgba(80,180,100,0.08)", border:"1px solid rgba(80,180,100,0.2)", marginBottom:4 }}>✓ Photo uploaded — AI will automatically analyze product visuals. Name/benefit below are optional but recommended.</div>}
            <Field label={imgSrc ? "Product Name (optional)" : "Product Name *"} value={form.productName} onChange={v => set("productName",v)} placeholder="e.g. Mini Bow Slingbag Chocolate" />
            <Field label="Key Benefit" value={form.productBenefit} onChange={v => set("productBenefit",v)} placeholder="e.g. Spacious, lightweight, perfect for daily use" />
          </Sec>
        )}

        {step === 7 && (
          <Sec title="Confirm" sub="Review before generating">
            {imgSrc && <ThumbImg src={imgSrc} />}
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {[
                ["Product Photo", imgSrc ? "✓ Uploaded — AI auto-analysis" : "Not uploaded (manual)"],
                ["Niche",       NICHES.find(n=>n.id===form.niche)?.label],
                ...(isFashion ? [["Kategori", FASHION_SUBCATEGORIES.find(s=>s.id===form.fashionSub)?.label || "—"]] : []),
                ["Platform",    PLATFORMS.find(p=>p.id===form.platform)?.label],
                ...(isFashion ? [] : [["Content", CONTENT_TYPES.find(c=>c.id===form.contentType)?.label]]),
                ["AI Tool",     AI_GENERATORS.find(a=>a.id===form.aiGen)?.label],
                ["Tone",        TONES.find(t=>t.id===form.tone)?.label],
                ["Product",      form.productName || "(from photo)"],
                ["Benefit",     form.productBenefit || "—"],
              ].map(([k,v]) => (
                <div key={k} style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"9px 12px", background:"rgba(255,255,255,0.03)",
                  borderRadius:8, border:"1px solid rgba(255,255,255,0.05)",
                }}>
                  <span style={{ fontSize:11, color:"#8899aa", textTransform:"uppercase", letterSpacing:1 }}>{k}</span>
                  <span style={{ fontSize:12, color: k==="Product Photo"&&imgSrc?"#88cc88":"#e0d0b0", fontWeight:500, maxWidth:"58%", textAlign:"right" }}>{v||"—"}</span>
                </div>
              ))}
            </div>
          </Sec>
        )}

        {step > 0 && (
          <div style={{ display:"flex", gap:10, marginTop:22 }}>
            <button onClick={() => setStep(s => s - 1)} style={{
              flex:1, padding:"13px", borderRadius:10, cursor:"pointer",
              background:"transparent", border:"1px solid rgba(255,255,255,0.1)",
              color:"#8899aa", fontSize:13, letterSpacing:1, fontFamily:"inherit",
            }}>← Back</button>
            <button onClick={nextStep} disabled={!canNext()} style={{
              flex:3, padding:"13px", borderRadius:10,
              cursor: canNext()?"pointer":"not-allowed",
              background: canNext() ? `linear-gradient(135deg,${gold},${gold2})` : "rgba(255,255,255,0.04)",
              border:"none",
              color: canNext()?"#1a1005":"#445566",
              fontSize:14, fontWeight:"700", letterSpacing:2,
              fontFamily:"inherit", transition:"all 0.2s",
            }}>{step===LAST_STEP ? "✦ GENERATE PROMPT" : "Lanjut →"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Sec({ title, sub, children }) {
  return (
    <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:10 }}>
      <div>
        <div style={{ fontSize:10, letterSpacing:4, color:"#c8a060", textTransform:"uppercase", marginBottom:5 }}>{sub}</div>
        <h2 style={{ margin:0, fontSize:20, fontWeight:"400", color:"#f0e0c0", letterSpacing:1 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Card({ selected, onClick, children, accent }) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); }
      }}
      style={{
        display:"flex", alignItems:"center", gap:14,
        padding:"13px 16px", borderRadius:12, cursor:"pointer",
        border: selected ? `1px solid ${accent||"#c8a060"}` : "1px solid rgba(255,255,255,0.07)",
        background: selected ? "rgba(200,160,80,0.09)" : "rgba(255,255,255,0.02)",
        transition:"all 0.17s ease",
        outlineOffset: 2,
      }}>{children}</div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label style={{ fontSize:11, color:"#8899aa", letterSpacing:1, textTransform:"uppercase", marginBottom:7, display:"block" }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:"100%", padding:"12px 14px", borderRadius:9, boxSizing:"border-box",
          background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
          color:"#e8e0d0", fontSize:13, outline:"none", fontFamily:"inherit" }} />
    </div>
  );
}

function ThumbImg({ src }) {
  return (
    <div style={{ borderRadius:8, overflow:"hidden", border:"1px solid rgba(255,255,255,0.08)", maxHeight:130, marginBottom:2 }}>
      <img src={src} alt="product" style={{ width:"100%", objectFit:"cover", display:"block", maxHeight:130 }} />
    </div>
  );
}
