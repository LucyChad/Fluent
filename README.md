# Fluent — Launch site

The Netlify + GitHub + Stripe storefront for fluent.md.

This folder is **deployment-ready**. Push it to a fresh GitHub repo, connect it to Netlify, add a few environment variables and create the Stripe products, and you're live.

---

## What's in here

```
site/
├── index.html              ← Landing page (hero, problem, catalogue, FAQ, footer)
├── thanks.html             ← Post-purchase download page (verifies Stripe session, serves zips)
├── netlify.toml            ← Netlify config (routes, headers, function bundling)
├── netlify/
│   └── functions/
│       ├── session.js      ← /api/session — verifies a paid session, returns SKUs
│       └── download.js     ← /api/download — streams a bundle zip after verifying the session
├── files/                  ← The 7 bundle zips (shipped with the function)
│   ├── pricing-your-offers.zip
│   ├── sound-human.zip
│   ├── ai-audio.zip
│   ├── local-marketing.zip
│   ├── loyal-customer-blueprint.zip
│   ├── know-like-trust.zip
│   └── magnetic-content.zip
├── .gitignore
└── README.md               ← This file
```

---

## How the buying flow works

1. Visitor lands on **index.html**, picks a skill, clicks "Get instant access" — opens a **Stripe Payment Link**.
2. Stripe handles checkout. On success, Stripe redirects to **`/thanks?session_id={CHECKOUT_SESSION_ID}`**.
3. **thanks.html** reads the session_id from the URL, calls **`/api/session`**, which uses your Stripe secret key to verify the session is paid and returns the list of SKUs purchased.
4. The page renders a "Download .zip" button per SKU. Each button calls **`/api/download?session_id=...&sku=...`** which re-verifies the session, checks the SKU was on it, and streams the bundle.

Token-protected. Server-side. No exposed secrets.

---

## Deployment — step by step

### 1. Push to GitHub

```bash
cd /Users/lucy/Documents/Claude/Projects/fluent.md/site
git init
git add .
git commit -m "Initial Fluent launch site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fluent-site.git
git push -u origin main
```

### 2. Connect Netlify

- Go to [app.netlify.com](https://app.netlify.com)
- **Add new site → Import from Git** → select the `fluent-site` repo
- Build settings: leave defaults (publish directory: `.`, functions directory: `netlify/functions`)
- Click **Deploy**
- Netlify gives you a URL like `clever-name-12345.netlify.app`. Test it works in a moment.

### 3. Set up Stripe products

In your Stripe dashboard (using whichever account you've decided on — Race Of The Day or Intelligent Impact):

For each of the **7 skills**, create a **Product** with:

- **Name:** the display name (e.g. "Sound Human")
- **Description:** the card copy from the landing page
- **Price:** £14.99 GBP, one-time
- **Metadata:** add one key `fluent_sku` with the value matching the bundle slug exactly:

| Product name | metadata.fluent_sku |
|---|---|
| Pricing Your Offers | `pricing-your-offers` |
| Sound Human | `sound-human` |
| AI Audio | `ai-audio` |
| Local Marketing | `local-marketing` |
| Loyal Customer Blueprint | `loyal-customer-blueprint` |
| Know, Like, Trust | `know-like-trust` |
| Magnetic Content | `magnetic-content` |

**Important:** the `fluent_sku` value must match the zip filename exactly (without the `.zip`). The download function uses this to find the right file.

Then for each Product, create a **Payment Link**:

- Single product, single price (£14.99)
- **After payment:** select "Don't show confirmation page — redirect to a URL"
- **URL:** `https://YOUR-DOMAIN/thanks?session_id={CHECKOUT_SESSION_ID}` (Stripe will substitute the actual session id automatically — the `{CHECKOUT_SESSION_ID}` literal is the placeholder syntax)

Copy each Payment Link URL.

### 4. Wire the Payment Links into index.html

In `index.html`, find the placeholders `STRIPE_LINK_PRICING`, `STRIPE_LINK_SOUND_HUMAN`, etc., and replace them with the actual Stripe Payment Link URLs.

There are 7 placeholders, one per product. Find and replace.

### 5. Add the Stripe secret key to Netlify

- In Netlify: **Site settings → Environment variables → Add variable**
- Key: `STRIPE_SECRET_KEY`
- Value: your Stripe secret key (starts with `sk_live_` for live mode, `sk_test_` for testing)
- Scopes: all (default)

**Important:** use the **same Stripe account** for the products and the secret key, otherwise the function won't find the sessions.

After adding, **redeploy** the site (Deploys → Trigger deploy) so the function picks up the new env var.

### 6. Wire up your email capture form

The landing page has a placeholder email form pointing at `GHL_FORM_ACTION_URL`. Replace with either:

**Option A — Kit (recommended for email-first):**
- Create a form in Kit → embed code → grab the `<form action="...">` URL from it
- Replace `GHL_FORM_ACTION_URL` with that URL
- Make sure the form posts to Kit's hosted endpoint and the `name="email"` field matches what Kit expects (Kit uses `email_address` or similar — check the embed code)

**Option B — GHL:**
- Create a form in your GHL workflow → grab the form URL or embed iframe
- Either swap the form action or replace the whole `<form>` block with GHL's `<iframe>` embed

Either way, the form just needs to capture email addresses to a list you control.

### 7. Add your custom domain

- In Netlify: **Domain management → Add custom domain**
- Add `fluent.md` (or whichever domain you've decided to lead with)
- Update DNS at your registrar to point at Netlify (Netlify will tell you what to set)
- Netlify auto-provisions SSL via Let's Encrypt within minutes

### 8. Test the full flow

- Go to your live site
- Click any "Get instant access" button → buy with a Stripe **test card** (`4242 4242 4242 4242`, any future expiry, any CVC)
- You should be redirected to `/thanks?session_id=cs_...`
- The page should show the download button for the product you bought
- Click it — the zip should download

If anything fails, check the **Netlify function logs** (Functions → session / download → View logs) — the functions log errors generously.

### 9. Flip to live mode

- In Stripe, switch from test mode to live mode
- Re-create the Products + Payment Links in live mode (test products don't auto-promote)
- Update `STRIPE_SECRET_KEY` in Netlify to the live key (`sk_live_...`)
- Update the Payment Link URLs in `index.html` to the live ones
- Push, deploy, and you're selling

---

## What you'll need ready before launch

- [x] Stripe account chosen (Race Of The Day or Intelligent Impact)
- [ ] 7 Stripe Products created (live mode) with `fluent_sku` metadata
- [ ] 7 Stripe Payment Links created (live mode) with `/thanks?session_id={CHECKOUT_SESSION_ID}` success URL
- [ ] `STRIPE_SECRET_KEY` (live) added to Netlify env vars
- [ ] Payment Link URLs wired into `index.html`
- [ ] Kit (or GHL) form action URL wired into the email capture form
- [ ] Custom domain added in Netlify, DNS pointed
- [ ] Full test purchase completed with a real card (small amount)

---

## A note on file delivery

The bundles ship inside the function (via Netlify's `included_files` in `netlify.toml`). This works cleanly up to about 50MB total — we're at ~250KB, so plenty of headroom for the catalogue to grow.

If at some point the bundles get larger (workbook PDFs added, self-study courses bundled), the cleaner move is to host them on **Netlify Blobs** or **AWS S3** and have the function return a signed download URL rather than streaming the file. The pattern is the same; the storage moves.

---

## Help, hello@fluent.md isn't real yet

You'll want to set up the email address on your domain (Google Workspace, Fastmail, or anything). The thanks page references `hello@fluent.md`. If you'd rather use a different address before that's set up, find-and-replace `hello@fluent.md` across the codebase.

---

## Production log

The full history of what was built, why, and what's deferred lives in `/Users/lucy/Documents/Claude/Projects/fluent.md/production-log.md`. The status of the whole project is in `FLUENT_STATUS.md` at the workspace root.
