// /api/stripe-webhook.js

import { Resend } from 'resend';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

function generateEmailHtml(orderDetails, totalAmount) {
    // ... (This function remains the same as before) ...
}

export default async function handler(req, res) {
  console.log("Webhook received."); // Log #1

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const buf = await new Promise((resolve, reject) => { /* ... (body parsing logic) ... */ });
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    console.log("Verifying Stripe signature..."); // Log #2
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    console.log("Signature verified."); // Log #3
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    console.log("Handling checkout.session.completed event."); // Log #4
    const session = event.data.object;

    // The line items are now included directly in the session object
    const lineItems = session.line_items;

    const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
    const customOrderDetails = JSON.parse(paymentIntent.metadata.orderDetails);
    
    const customerEmail = session.customer_details.email;
    const totalAmount = (session.amount_total / 100).toFixed(2);
    
    const emailHtml = generateEmailHtml(customOrderDetails, totalAmount);
    
    try {
      console.log("Sending emails..."); // Log #5
      await resend.emails.send({ /* ... (customer email) ... */ });
      await resend.emails.send({ /* ... (owner email) ... */ });
      console.log("Emails sent successfully.");// Log #6
    } catch (error) {
      console.error("Error sending emails:", error);
    }
  }

  console.log("Responding to Stripe."); // Log #7
  res.status(200).json({ received: true });
}

export const config = { api: { bodyParser: false } };