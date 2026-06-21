// Netlify Function: /api/session
// Verifies a Stripe Checkout session and returns the fluent SKUs purchased.
// Called from the thanks page to render download buttons.
//
// Required env var: STRIPE_SECRET_KEY (set in Netlify dashboard → Site settings → Environment variables)
//
// Each Stripe Product must have metadata.fluent_sku set to the bundle slug
// (e.g. "sound-human", "pricing-your-offers"). The slug is the filename of the
// zip in /files/ (without the .zip extension).

const STRIPE_API = 'https://api.stripe.com/v1';

exports.handler = async (event) => {
    // CORS / basic checks
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    const sessionId = (event.queryStringParameters || {}).session_id;
    if (!sessionId || !sessionId.startsWith('cs_')) {
        return jsonError(400, 'Missing or malformed session_id');
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
        console.error('STRIPE_SECRET_KEY not configured');
        return jsonError(500, 'Server misconfigured');
    }

    try {
        // Retrieve the session with line items + products expanded
        const url = `${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`
                  + `?expand[]=line_items.data.price.product`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${secret}` }
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error('Stripe session retrieval failed:', res.status, errBody);
            return jsonError(404, 'Session not found');
        }

        const session = await res.json();

        // Only release downloads for paid sessions
        if (session.payment_status !== 'paid') {
            return jsonError(403, 'Payment not complete');
        }

        // Expand each purchased product into one or more SKUs.
        // A bundle product sets metadata.fluent_skus to a comma-separated list of
        // child slugs (e.g. "know-like-trust,magnetic-content,sound-human").
        // A single product sets metadata.fluent_sku to one slug.
        const skus = [];
        for (const li of (session.line_items?.data || [])) {
            const md = li.price?.product?.metadata || {};
            if (md.fluent_skus) {
                md.fluent_skus.split(',').map(s => s.trim()).filter(Boolean).forEach(s => skus.push(s));
            } else if (md.fluent_sku) {
                skus.push(md.fluent_sku.trim());
            }
        }

        if (skus.length === 0) {
            return jsonError(404, 'No Fluent products found on this session');
        }

        return jsonOk({
            session_id: sessionId,
            customer_email: session.customer_details?.email || null,
            skus: [...new Set(skus)], // dedupe in case of repeats
            amount_total: session.amount_total,
            currency: session.currency
        });
    } catch (err) {
        console.error('Session lookup error:', err);
        return jsonError(500, 'Internal error');
    }
};

function jsonOk(body) {
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    };
}

function jsonError(statusCode, message) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: message })
    };
}
