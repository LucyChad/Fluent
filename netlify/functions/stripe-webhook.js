// Netlify Function: /api/stripe-webhook
// Sends the delivery email when a purchase completes, and (best-effort) tags the
// buyer in Kit. Built for reliability: Stripe retries the webhook on any non-2xx,
// so a failed email send returns 500 and Stripe will try again.
//
// Required env vars:
//   STRIPE_SECRET_KEY      - already set (used to fetch the session + line items)
//   STRIPE_WEBHOOK_SECRET  - the signing secret from the Stripe webhook endpoint
//   RESEND_API_KEY         - transactional email (resend.com)
// Optional env vars:
//   KIT_API_KEY            - if set, the buyer is upserted + tagged in Kit (best-effort)
//   DELIVERY_FROM          - from address; defaults to "Fluent <hello@fluent.md>"

const crypto = require('crypto');

const STRIPE_API = 'https://api.stripe.com/v1';
const SITE = 'https://fluent.md';

// SKU -> friendly title for the email (mirrors thanks.html)
const SKU_TITLES = {
    'pricing-your-offers': 'How To Price Your Offers',
    'sound-human': 'How To Sound Human Using AI',
    'ai-audio': 'How To Add AI Audio To Your Content',
    'local-marketing': 'How To Win Your Local Market',
    'loyal-customer-blueprint': 'How To Turn One-Time Buyers Into Loyal Customers',
    'know-like-trust': 'How To Build Know, Like, Trust In 30 Days',
    'magnetic-content': 'How To Create Content That Pulls People In',
    'manage-your-time': 'How To Manage Your Time Effectively'
};

// SKU -> Kit tag id (existing tags in the account; manage-your-time added separately)
const SKU_KIT_TAG = {
    'pricing-your-offers': 20233417,
    'sound-human': 20233418,
    'ai-audio': 20233419,
    'local-marketing': 20233420,
    'loyal-customer-blueprint': 20233421,
    'know-like-trust': 20233422,
    'magnetic-content': 20233423,
    'manage-your-time': 20542767
};
const KIT_CUSTOMER_TAG = 20233416; // "fluent: customer"

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!whSecret || !stripeSecret || !resendKey) {
        console.error('Missing required env vars');
        return { statusCode: 500, body: 'Server misconfigured' };
    }

    // Raw body (Netlify may base64-encode it). Signature must be checked on the raw bytes.
    const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body;

    // --- Verify Stripe signature ---
    if (!verifyStripeSignature(rawBody, sig, whSecret)) {
        console.error('Invalid Stripe signature');
        return { statusCode: 400, body: 'Invalid signature' };
    }

    let evt;
    try { evt = JSON.parse(rawBody); } catch (e) { return { statusCode: 400, body: 'Bad JSON' }; }

    if (evt.type !== 'checkout.session.completed') {
        return { statusCode: 200, body: 'Ignored' }; // not an event we act on
    }

    try {
        const sessionId = evt.data.object.id;

        // Fetch the session with line items + products expanded (payload doesn't include them)
        const res = await fetch(
            `${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items.data.price.product`,
            { headers: { 'Authorization': `Bearer ${stripeSecret}` } }
        );
        if (!res.ok) {
            console.error('Session fetch failed', res.status, await res.text());
            return { statusCode: 500, body: 'Session fetch failed' }; // Stripe will retry
        }
        const session = await res.json();

        if (session.payment_status !== 'paid') {
            return { statusCode: 200, body: 'Not paid; ignored' };
        }

        const email = session.customer_details && session.customer_details.email;
        if (!email) {
            console.error('No customer email on session', sessionId);
            return { statusCode: 200, body: 'No email; nothing to send' };
        }

        // Expand SKUs (bundles set fluent_skus comma list; singles set fluent_sku)
        const skus = [];
        for (const li of (session.line_items && session.line_items.data) || []) {
            const md = (li.price && li.price.product && li.price.product.metadata) || {};
            if (md.fluent_skus) md.fluent_skus.split(',').map(s => s.trim()).filter(Boolean).forEach(s => skus.push(s));
            else if (md.fluent_sku) skus.push(md.fluent_sku.trim());
        }
        const uniqueSkus = [...new Set(skus)];
        if (uniqueSkus.length === 0) {
            return { statusCode: 200, body: 'No Fluent products; ignored' };
        }

        const downloadUrl = `${SITE}/thanks?session_id=${encodeURIComponent(sessionId)}`;

        // --- Send the delivery email (must succeed; 500 => Stripe retries) ---
        await sendDeliveryEmail({ resendKey, email, skus: uniqueSkus, downloadUrl });

        // --- Best-effort: tag the buyer in Kit (never blocks delivery) ---
        if (process.env.KIT_API_KEY) {
            try { await tagInKit(email, uniqueSkus); }
            catch (e) { console.error('Kit tagging failed (non-fatal):', e.message); }
        }

        return { statusCode: 200, body: 'OK' };
    } catch (err) {
        console.error('Webhook error:', err);
        return { statusCode: 500, body: 'Internal error' }; // Stripe retries
    }
};

function verifyStripeSignature(payload, header, secret) {
    if (!header) return false;
    const parts = Object.fromEntries(header.split(',').map(kv => kv.split('=')));
    const t = parts.t, v1 = parts.v1;
    if (!t || !v1) return false;
    // tolerance: 5 minutes
    if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(t, 10)) > 300) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
    } catch (e) { return false; }
}

async function sendDeliveryEmail({ resendKey, email, skus, downloadUrl }) {
    const from = process.env.DELIVERY_FROM || 'Fluent <hello@fluent.md>';
    const items = skus.map(s => SKU_TITLES[s] || s);
    const itemsHtml = items.map(t => `<li style="margin:0 0 6px;">${escapeHtml(t)}</li>`).join('');
    const itemsText = items.map(t => `- ${t}`).join('\n');

    const html = `<!DOCTYPE html><html><body style="margin:0;background:#0B1322;font-family:'Helvetica Neue',Arial,sans-serif;color:#1E1612;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:bold;font-size:26px;color:#F5E8D8;">Fluent<span style="color:#E58A5E;">.</span></span>
    </div>
    <div style="background:#F5E8D8;border-radius:16px;padding:34px 30px;">
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 14px;color:#1E1612;">You're in. Here are your downloads.</h1>
      <p style="font-size:15px;line-height:1.6;color:#4A3A30;margin:0 0 18px;">Thanks for your order. Your Course Skill${items.length > 1 ? 's are' : ' is'} ready to download and install:</p>
      <ul style="font-size:15px;line-height:1.5;color:#1E1612;padding-left:20px;margin:0 0 24px;">${itemsHtml}</ul>
      <p style="text-align:center;margin:0 0 26px;">
        <a href="${downloadUrl}" style="display:inline-block;background:#0B1322;color:#F5E8D8;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 30px;border-radius:100px;">Open your downloads</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#4A3A30;margin:0 0 6px;">Keep this email. The link above is your permanent access to your files, and it always serves the latest version. Each bundle includes a Word install guide that walks you through Claude, ChatGPT and Gemini.</p>
      <p style="font-size:13px;line-height:1.6;color:#4A3A30;margin:18px 0 0;">Stuck on anything? Just reply to this email and we'll sort it.</p>
    </div>
    <p style="text-align:center;font-size:11px;color:rgba(245,224,208,0.5);margin:22px 0 0;">Fluent is a trading name of Intelligent Impact Group Ltd. fluent.md</p>
  </div>
</body></html>`;

    const text = `You're in. Here are your downloads.

Thanks for your order. Your Course Skill${items.length > 1 ? 's are' : ' is'} ready:
${itemsText}

Open your downloads: ${downloadUrl}

Keep this email. That link is your permanent access and always serves the latest version. Each bundle includes a Word install guide for Claude, ChatGPT and Gemini.

Stuck on anything? Reply to this email and we'll sort it.

Fluent is a trading name of Intelligent Impact Group Ltd. fluent.md`;

    const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from,
            to: [email],
            reply_to: 'hello@fluent.md',
            subject: 'Your Fluent download' + (items.length > 1 ? 's are ready' : ' is ready'),
            html,
            text
        })
    });
    if (!r.ok) {
        const body = await r.text();
        throw new Error(`Resend send failed: ${r.status} ${body}`);
    }
}

async function tagInKit(email, skus) {
    const key = process.env.KIT_API_KEY;
    const headers = { 'X-Kit-Api-Key': key, 'Content-Type': 'application/json' };
    // Upsert subscriber
    await fetch('https://api.kit.com/v4/subscribers', {
        method: 'POST', headers,
        body: JSON.stringify({ email_address: email })
    });
    const tagIds = new Set([KIT_CUSTOMER_TAG]);
    for (const s of skus) if (SKU_KIT_TAG[s]) tagIds.add(SKU_KIT_TAG[s]);
    for (const id of tagIds) {
        await fetch(`https://api.kit.com/v4/tags/${id}/subscribers`, {
            method: 'POST', headers,
            body: JSON.stringify({ email_address: email })
        });
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
