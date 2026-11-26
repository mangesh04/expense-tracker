# Expenses (React + PWA)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/
npm run preview    # test the production build (service worker only runs in production)
```

Deploy `dist/` to any HTTPS host (Vercel, Netlify, Cloudflare Pages...). Once it is live,
open it on your phone and use "Add to Home Screen" / "Install app".

Supabase keys come from `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); see `.env.example`.
If unset, the values from your original file are used.

## PhonePe screenshot scan
Friends: give each friend a nickname and (optionally) their real bank name as PhonePe shows it. Add entry -> "Scan PhonePe screenshot". OCR runs in the browser with Tesseract.js (no API key, image never uploaded).
The engine (~3 MB) downloads from a CDN on the first scan and is cached after that.
Parsing lives in `src/lib/receipt.js`; the OCR call is in `src/lib/scan.js`.
