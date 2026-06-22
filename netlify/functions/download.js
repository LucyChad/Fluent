// Netlify Function: /api/download
// Validates that a Stripe session purchased the requested SKU, then returns the zip.
//
// Required env var: STRIPE_SECRET_KEY
// Required bundled file: files/{sku}.zip (configured in netlify.toml via included_files)

const fs = require('fs');
const path = require('path');

const STRIPE_API = 'https://api.stripe.com/v1';

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    const { session_id: sessionId, sku } = event.queryStringParameters || {};
    if (!sessionId || !sessionId.startsWith('cs_')) {
        return textResponse(400, 'Missing or malformed session_id');
    }
    if (!sku || !/^[a-z0-9-]+$/.test(sku)) {
        return textResponse(400, 'Missing or malformed sku');
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
        console.error('STRIPE_SECRET_KEY not configured');
        return textResponse(500, 'Server misconfigured');
    }

    try {
        // Verify the session and that it contains the requested SKU
        const url = `${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`
                  + `?expand[]=line_items.data.price.product`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${secret}` }
        });

        if (!res.ok) {
            return textResponse(404, 'Session not found');
        }

        const session = await res.json();

        if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
            return textResponse(403, 'Payment not complete');
        }

        // Expand each purchased product into one or more SKUs. Bundle products
        // set metadata.fluent_skus (comma-separated child slugs); single products
        // set metadata.fluent_sku. The requested sku must be in the expanded set.
        const skus = [];
        for (const li of (session.line_items?.data || [])) {
            const md = li.price?.product?.metadata || {};
            if (md.fluent_skus) {
                md.fluent_skus.split(',').map(s => s.trim()).filter(Boolean).forEach(s => skus.push(s));
            } else if (md.fluent_sku) {
                skus.push(md.fluent_sku.trim());
            }
        }

        if (!skus.includes(sku)) {
            return textResponse(403, 'This SKU was not purchased on this session');
        }

        // Load the zip from the bundled files
        // Netlify functions run with cwd = function dir; the bundled files end up alongside
        const candidates = [
            path.join(__dirname, '../../files', `${sku}.zip`),
            path.join(process.cwd(), 'files', `${sku}.zip`),
            path.join(__dirname, 'files', `${sku}.zip`)
        ];

        let filePath = null;
        for (const p of candidates) {
            if (fs.existsSync(p)) {
                filePath = p;
                break;
            }
        }

        if (!filePath) {
            console.error('Bundle not found for sku:', sku, 'tried:', candidates);
            return textResponse(404, 'Bundle file missing');
        }

        const data = fs.readFileSync(filePath);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${sku}.zip"`,
                'Cache-Control': 'no-store, private'
            },
            body: data.toString('base64'),
            isBase64Encoded: true
        };
    } catch (err) {
        console.error('Download error:', err);
        return textResponse(500, 'Internal error');
    }
};

function textResponse(statusCode, message) {
    return {
        statusCode,
        headers: { 'Content-Type': 'text/plain' },
        body: message
    };
}
