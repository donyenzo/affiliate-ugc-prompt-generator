// api/generate-prompt.js
// Vercel Serverless Function — proxy aman ke OpenRouter API.
//
// KENAPA FILE INI PERLU ADA:
// Browser TIDAK BISA memanggil API AI langsung (CORS block + butuh API key
// yang tidak boleh ditaruh di kode frontend). File ini jalan di server Vercel, menyimpan API key
// dengan aman lewat Environment Variable, lalu meneruskan (proxy) request dari frontend ke Anthropic.
//
// SETUP WAJIB DI VERCEL:
// 1. Buka project di Vercel Dashboard → Settings → Environment Variables
// 2. Tambah variable: OPENROUTER_API_KEY = sk-or-v1-xxxx (key dari openrouter.ai/keys)
// 3. Redeploy project setelah menambah env var (env var baru tidak otomatis ke-apply ke deployment lama)

// ── Rate limiting sederhana (in-memory, per cold-start instance) ──────────────────────────
// CATATAN JUJUR: Vercel serverless function bisa punya banyak instance berjalan paralel,
// dan memory di-reset tiap cold start. Jadi rate limit ini TIDAK 100% akurat lintas instance,
// tapi tetap efektif meredam spam-click dari 1 user di 1 instance yang sama.
// Untuk rate-limiting yang benar-benar akurat di production dengan traffic tinggi,
// pertimbangkan Vercel KV atau Upstash Redis (durable, shared antar instance).
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 8;          // maksimal request
const RATE_LIMIT_WINDOW_MS = 60_000; // per 60 detik

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

// Bersihkan entry lama supaya Map tidak membengkak tanpa batas
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) rateLimitMap.delete(ip);
  }
}

const TIMEOUT_MS = 45_000; // 45 detik — cukup untuk image+text generation, tapi tidak stuck selamanya

export default async function handler(req, res) {
  // CORS — izinkan dipanggil dari origin yang sama (dan bisa dibatasi lebih ketat kalau perlu)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed. Use POST." } });
  }

  // ── Rate limiting per-IP ──────────────────────────────────────────────
  cleanupRateLimitMap();
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: { message: "Terlalu banyak permintaan. Coba lagi dalam 1 menit." },
    });
  }

  // ── Validasi API key server tersedia ──────────────────────────────────
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY belum di-set di Environment Variables Vercel.");
    return res.status(500).json({
      error: { message: "Server belum dikonfigurasi (API key hilang). Hubungi admin." },
    });
  }

  // ── Validasi payload dari frontend ────────────────────────────────────
  const { system, imgB64, mediaType } = req.body || {};
  if (!system || typeof system !== "string") {
    return res.status(400).json({ error: { message: "Field 'system' wajib diisi." } });
  }
  if (!imgB64 || typeof imgB64 !== "string") {
    return res.status(400).json({ error: { message: "Field 'imgB64' wajib diisi." } });
  }
  // Batas kasar ukuran base64 (≈8MB gambar asli → ~10.9MB base64) supaya tidak ada payload raksasa nyasar ke API
  const MAX_B64_LENGTH = 15_000_000;
  if (imgB64.length > MAX_B64_LENGTH) {
    return res.status(413).json({ error: { message: "Ukuran gambar terlalu besar." } });
  }

  // ── Panggil OpenRouter API dengan timeout ──────────────────────────────
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // OpenRouter = API kompatibel OpenAI (endpoint chat/completions), bukan format Anthropic.
    const model = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5";
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-Title": "Affiliate UGC Prompt Generator",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mediaType || "image/jpeg"};base64,${imgB64}` } },
              { type: "text", text: "Analyze this product and generate the three prompts." },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const raw = await upstream.json();

    if (!upstream.ok || raw?.error) {
      return res.status(upstream.ok ? 502 : upstream.status).json({
        error: { message: raw?.error?.message || `OpenRouter error (HTTP ${upstream.status})` },
      });
    }

    // Ubah format OpenRouter -> format yang dibaca frontend ({ content: [{type:"text", text}] })
    const choice = raw?.choices?.[0];
    const text = choice?.message?.content;
    if (typeof text !== "string" || !text) {
      return res.status(502).json({ error: { message: "AI mengembalikan respons kosong. Coba lagi." } });
    }
    const data = {
      content: [{ type: "text", text }],
      stop_reason: choice.finish_reason === "length" ? "max_tokens" : "end_turn",
    };

    return res.status(200).json(data);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return res.status(504).json({
        error: { message: "Permintaan ke AI melebihi batas waktu (45 detik). Coba lagi." },
      });
    }
    console.error("Proxy error:", err);
    return res.status(502).json({
      error: { message: "Gagal terhubung ke layanan AI. Coba lagi sebentar." },
    });
  }
}
