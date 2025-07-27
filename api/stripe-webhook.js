// /api/stripe-webhook.js

import { Resend } from 'resend';

// Initialize Stripe with your secret key from environment variables
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Initialize Resend with your API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // This is a special way to get the raw request body for Stripe's signature verification
  const buf = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify the event came from Stripe
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Retrieve line items to get order details
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

    const customerEmail = session.customer_details.email;
    const orderDetails = lineItems.data.map(item => 
      `<li>${item.quantity}x ${item.description} - $${(item.amount_total / 100).toFixed(2)}</li>`
    ).join('');

    try {
      // --- Send Confirmation Email to the Customer ---
      await resend.emails.send({
        from: 'QuantumID Sales <sales@getquid.com>',
        to: [customerEmail],
        subject: 'Your QuantumID Order Confirmation',
        html: `<h1>Thank You for Your Order!</h1>
               <p>We've received your order and will begin processing it shortly.</p>
               <h2>Order Summary:</h2>
               <ul>${orderDetails}</ul>
               <p>Total: <strong>$${(session.amount_total / 100).toFixed(2)}</strong></p>`,
      });

      // --- Send Notification Email to Yourself ---
      await resend.emails.send({
        from: 'Website Notifier <noreply@getquid.com>', // Using noreply for notifications is a common practice
        to: ['2000Daniil2106@gmail.com'],
        subject: 'New Order Received!',
        html: `<h1>New Order on GetQID.com</h1>
               <p>A new order has been placed by ${customerEmail}.</p>
               <h2>Order Summary:</h2>
               <ul>${orderDetails}</ul>
               <p>Total: <strong>$${(session.amount_total / 100).toFixed(2)}</strong></p>`,
      });

    } catch (error) {
      console.error("Error sending emails:", error);
      // Don't block the response to Stripe, just log the error
    }
  }

  // Acknowledge the event was received
  res.status(200).json({ received: true });
}

// Vercel requires a config to access the raw request body
export const config = {
  api: {
    bodyParser: false,
  },
};