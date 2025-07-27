// /api/stripe-webhook.js

import { Resend } from 'resend';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// --- Email Template Function ---
function generateEmailHtml(orderDetails, totalAmount) {
    const cartItemsHtml = orderDetails.cart.map(item => {
        const colorConfig = designLayers[item.design] || designLayers.default;
        const colorStrings = colorConfig.layers.map(layerKey => `<li>${item.colors[layerKey].name}</li>`).join('');
        return `
            <div style="border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 15px;">
                <p><strong>${item.quantity}x ${item.productName}</strong></p>
                <p style="color:#555; margin-left: 15px;">Colors:</p>
                <ul style="color:#555; margin-left: 30px;">${colorStrings}</ul>
            </div>
        `;
    }).join('');

    const customTextHtml = orderDetails.customText !== 'Not included' 
        ? `<p><strong>Custom Text Add-on:</strong> ${orderDetails.customText}</p>` 
        : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
                .header { text-align: center; margin-bottom: 20px; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #999; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header"><h1>QuantumID Order Summary</h1></div>
                <h3>Order Details:</h3>
                ${cartItemsHtml}
                <h3>Additional Info:</h3>
                <p><strong>NFC Link URL:</strong> ${orderDetails.nfcUrl}</p>
                ${customTextHtml}
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="text-align: right; font-size: 18px;"><strong>Total: $${totalAmount}</strong></p>
                <div class="footer"><p>&copy; ${new Date().getFullYear()} QuantumID</p></div>
            </div>
        </body>
        </html>
    `;
}

// --- Main Webhook Handler ---
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const buf = await new Promise((resolve) => { /* ... (body parsing logic remains the same) ... */ });
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Retrieve the Payment Intent to access the metadata
    const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
    const metadata = paymentIntent.metadata;
    const customOrderDetails = JSON.parse(metadata.orderDetails);
    
    const customerEmail = session.customer_details.email;
    const totalAmount = (session.amount_total / 100).toFixed(2);
    
    const emailHtml = generateEmailHtml(customOrderDetails, totalAmount);

    try {
      await resend.emails.send({
        from: 'QuantumID Sales <sales@getqid.com>',
        to: [customerEmail],
        subject: 'Your QuantumID Order Confirmation',
        html: `<h1>Thank You for Your Order!</h1><p>We've received your order and will begin processing it shortly.</p>${emailHtml}`,
      });

      await resend.emails.send({
        from: 'Website Notifier <noreply@getqid.com>',
        to: ['2000Daniil2106@gmail.com'],
        subject: 'New Order Received!',
        html: `<h1>New Order on GetQID.com from ${customerEmail}</h1>${emailHtml}`,
      });
    } catch (error) {
      console.error("Error sending emails:", error);
    }
  }

  res.status(200).json({ received: true });
}

export const config = { api: { bodyParser: false } };