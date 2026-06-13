# Stripe setup — quick checklist

A focused checklist for setting up the 7 Stripe Products and Payment Links. Pair with the full deployment guide in `README.md`.

---

## Before you start

- Decide which Stripe account is invoicing: **Race Of The Day** or **Intelligent Impact**.
- Switch to that account in your Stripe dashboard.
- Decide whether you're testing first (Test mode toggle at top right) or going straight to live.

---

## Create 7 Products

For each one:

1. **Catalogue → Products → Add product**
2. Fill in the fields below
3. Click **Add metadata** under the product info — add a key `fluent_sku` with the value listed
4. Add a one-time price of **£14.99 GBP**
5. Save

| # | Product name | Description (paste this) | metadata.fluent_sku | Price |
|---|---|---|---|---|
| 1 | How To Price Your Offers | A pricing strategist. Find the right number for what you sell, articulate the value, hold the line on objections, build a pricing strategy that reflects what your work is actually worth. | `pricing-your-offers` | £14.99 |
| 2 | How To Sound Human Using AI | An AI writing coach for people who use AI to write but don't want to sound like everyone else who uses AI. Voice snapshots, prompt construction, fixing the patterns that scream "AI wrote this". | `sound-human` | £14.99 |
| 3 | How To Add AI Audio To Your Content | An audio production coach for adding AI narration to your videos, slides, training, and content. No studio, no microphones, no recording dread. | `ai-audio` | £14.99 |
| 4 | How To Win Your Local Market | A local marketing strategist for small businesses with a physical or local-service presence. Customer avatar, UVP, Google Business Profile, partnerships, social proof, loyalty — the lot. | `local-marketing` | £14.99 |
| 5 | How To Turn One-Time Buyers Into Loyal Customers | Turn one-time buyers into repeat customers and advocates. A 30-day plan covering identification, communication, offers, feedback, and the metrics that tell you it's working. | `loyal-customer-blueprint` | £14.99 |
| 6 | How To Build Know, Like, Trust In 30 Days | The 30-day journey of becoming someone your audience knows about, warms to, and is willing to trust. Specific daily actions across visibility, personal connection, and credibility. | `know-like-trust` | £14.99 |
| 7 | How To Create Content That Pulls People In | A content strategist for content that pulls people in rather than chases them. The 5 Secrets of magnetic content, an audience idea bank, and a working 90-day calendar system. | `magnetic-content` | £14.99 |
| 8 | How To Manage Your Time Effectively | A time management coach for small business owners. The 3 P's system: Prioritise, Plan, Produce. Cut the list, plan the week, get the work that matters done. | `manage-your-time` | £14.99 |

**Note (#8 Manage Your Time):** Product + price already created live via the Stripe MCP — Product `prod_UgXeEjOGUzWLVq`, Price `price_1ThAYqCE50urKgDfgAi4MmB8`. You only need to create the Payment Link (the MCP can't do that step). Open the product, create a payment link on `price_1ThAYqCE50urKgDfgAi4MmB8`, set the redirect to `https://fluent.md/thanks?session_id={CHECKOUT_SESSION_ID}`, enable promotion codes, then paste the URL over `STRIPE_LINK_MANAGE_YOUR_TIME` in `index.html`.

---

## Create 7 Payment Links

For each Product:

1. Open the product
2. Click **Create payment link** (or **Payments → Payment links → Add new**)
3. Select the Product and Price
4. Under **After payment** → choose "**Don't show confirmation page — Redirect customers to your website**"
5. URL: `https://YOUR-DOMAIN/thanks?session_id={CHECKOUT_SESSION_ID}`
   - Replace `YOUR-DOMAIN` with your live domain (e.g. `fluent.md`)
   - Keep `{CHECKOUT_SESSION_ID}` literal — Stripe substitutes it automatically
6. **(Optional)** Under **Advanced options → Collect email**: set to **Always** so we capture buyer email for follow-up
7. Save and **copy the payment link URL**

---

## Place the links into index.html

In `site/index.html`, find these placeholders and replace each with the corresponding Payment Link URL:

| Placeholder | Replace with |
|---|---|
| `STRIPE_LINK_PRICING` | Pricing Your Offers payment link |
| `STRIPE_LINK_SOUND_HUMAN` | Sound Human payment link |
| `STRIPE_LINK_AI_AUDIO` | AI Audio payment link |
| `STRIPE_LINK_LOCAL_MARKETING` | Local Marketing payment link |
| `STRIPE_LINK_LOYAL_CUSTOMER` | Loyal Customer Blueprint payment link |
| `STRIPE_LINK_KLT` | Know, Like, Trust payment link |
| `STRIPE_LINK_MAGNETIC` | Magnetic Content payment link |

Search index.html for `STRIPE_LINK_` to find them all quickly.

---

## Get the secret key into Netlify

- Stripe Dashboard → **Developers → API keys**
- Reveal the **Secret key** (`sk_live_...` for live mode, `sk_test_...` for test mode)
- Copy
- In Netlify Dashboard → **Site settings → Environment variables → Add variable**:
  - Key: `STRIPE_SECRET_KEY`
  - Value: paste the secret key
  - Scopes: All
- **Redeploy** the site so functions pick up the new env var

---

## Test the flow

1. Go to your live site
2. Buy one product using Stripe's test card `4242 4242 4242 4242` (if in test mode)
3. Land on `/thanks?session_id=cs_...`
4. Verify the page shows the right product
5. Click **Download .zip** — file should download
6. Open the zip — should contain `[sku]/SKILL.md`, `references/`, `assets/`, `HOW-TO-INSTALL.md`

If you bought multiple skills in test mode and want to verify multi-product handling, use Stripe's **Quote** or **Custom checkout** features to bundle in test, or use the live flow when ready.

---

## Common mistakes

- **`fluent_sku` metadata typo.** Must match the zip filename exactly (`sound-human` not `Sound-Human` or `sound_human`).
- **Secret key from wrong account.** If you have Race Of The Day and Intelligent Impact, make sure the products AND the secret key are in the same account.
- **Test products with live secret key (or vice versa).** Stripe segregates test and live mode; sessions in one won't be found by the other.
- **Payment Link success URL missing the `{CHECKOUT_SESSION_ID}` placeholder.** Without it, the thanks page won't know which session to verify.
- **Forgetting to redeploy after adding the env var.** Functions only pick up env vars at build time.
