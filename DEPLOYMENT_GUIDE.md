# Deployment Guide - Affiliate & UGC Prompt Generator

## Quick Start Vercel Deployment

### 1. Siapkan Anthropic API Key
- Buka https://console.anthropic.com
- Login dengan akun Anthropic Anda
- Buat API key baru
- Copy API key (format: `sk-ant-...`)

### 2. Push Repository ke GitHub
Repository ini sudah ada di:
```
https://github.com/donyenzo/affiliate-ugc-prompt-generator
```

### 3. Deploy ke Vercel

#### Opsi A: Via Vercel Dashboard
1. Buka https://vercel.com
2. Click "Add New" → "Project"
3. Pilih repository: `affiliate-ugc-prompt-generator`
4. Biarkan default settings (Framework: Vite, Build Command: `npm run build`)
5. Di "Environment Variables", tambahkan:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-xxxxxxxxxx` (paste API key Anda)
6. Click "Deploy"

#### Opsi B: Via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel
# Follow prompts, set ANTHROPIC_API_KEY saat diminta
```

### 4. Verifikasi Deployment

Setelah deploy, cek:

✅ Frontend load di URL yang diberikan Vercel
✅ Tidak ada error di Console (F12 → Console tab)
✅ Environment variable berhasil di-apply (lihat Vercel Dashboard → Settings → Environment Variables)

Jika ada error "API key hilang", pastikan:
- Environment variable `ANTHROPIC_API_KEY` sudah diset
- Redeploy project setelah menambah env var (env var baru tidak otomatis ter-apply)

### 5. Local Testing (sebelum deploy)

```bash
# Install dependencies
npm install

# Set environment variable
export ANTHROPIC_API_KEY=sk-ant-xxxxx  # Linux/Mac
set ANTHROPIC_API_KEY=sk-ant-xxxxx     # Windows

# Run dev server
npm run dev

# Build untuk production
npm run build

# Preview build
npm run preview
```

## Project Structure

```
affiliate-ugc-prompt-generator/
├── App.jsx                 # Main React component (UI wizard + prompts)
├── api/
│   └── generate-prompt.js  # Vercel serverless function (proxy ke Anthropic)
├── index.html              # Entry point
├── src/
│   └── main.jsx            # React root
├── vite.config.js          # Vite configuration
├── package.json            # Dependencies
├── vercel.json             # Vercel configuration
└── .env.example            # Environment template
```

## API Flow

```
Browser Frontend
    ↓
/api/generate-prompt.js (Vercel Serverless)
    ↓
Anthropic API (api.anthropic.com)
    ↓
Claude Vision Model (analisis foto + generate prompt)
    ↓
JSON Response → Frontend
```

## Troubleshooting

### Error: "API key hilang"
**Solusi:** Pastikan `ANTHROPIC_API_KEY` sudah diset di Vercel Dashboard, lalu redeploy.

### Error: "Permintaan melebihi batas waktu"
**Penyebab:** Upload foto terlalu besar atau AI processing terlalu lama.
**Solusi:** 
- Gunakan foto < 8MB
- Coba lagi dalam beberapa menit
- Check Vercel logs untuk detail

### Build gagal di Vercel
**Debug steps:**
1. Lihat Build Logs di Vercel Dashboard
2. Pastikan `npm install` berhasil
3. Pastikan `npm run build` tidak error locally

## Tips

- **Draft Auto-Save:** Form Anda disimpan otomatis di browser (localStorage)
- **Photo tidak disimpan:** Base64 images tidak disimpan ke localStorage (ukuran terlalu besar)
- **Refresh data:** Clear browser cache → localStorage → reload

## Support

Untuk issue dengan:
- **Deployment:** Cek Vercel Docs https://vercel.com/docs
- **Anthropic API:** Cek https://docs.anthropic.com
- **React/Vite:** Cek https://vitejs.dev

---

Semoga deployment lancar! 🚀
