# Affiliate & UGC Prompt Generator

Aplikasi web untuk membuat prompt AI untuk konten affiliate/UGC di TikTok, Instagram Reels, YouTube Shorts, dan Instagram Feed.

Fitur:
- Pilih niche produk (beauty, fashion, tech, home, dll)
- Pilih platform target
- Pilih AI generator
- Upload foto produk (opsional)
- Generate image prompt, intro video prompt, video prompt, dan caption
- Disimpan otomatis sebagai draft di browser

## Stack
- React
- Vite
- Node.js (Vercel serverless proxy)

## Prasyarat
- Node.js 18+
- Key Anthropic API di Vercel (`ANTHROPIC_API_KEY`)

## Instalasi lokal
```bash
npm install
npm run dev
```

## Build produksi
```bash
npm run build
```

## Deploy ke Vercel
1. Push repo ini ke GitHub
2. Import repo ke Vercel
3. Tambahkan environment variable:
   - `ANTHROPIC_API_KEY=sk-ant-...`
4. Deploy

## Catatan penting
Frontend tidak mengirim API key. Semua akses Anthropic lewat proxy serverless di `api/generate-prompt.js`.
