// /api/create-checkout-session.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    // Receive the array of line items directly from the frontend
    const { line_items } = req.body;

    if (!line_items || !Array.isArray(line_items)) {
        return res.status(400).json({ error: { message: "Invalid order data provided." } });
    }

    // Create a Checkout Session, passing the line_items array directly
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: line_items, // Pass the array from the frontend
      success_url: `${req.headers.origin}/success.html`,
      cancel_url: `${req.headers.origin}/`,
    });

    res.status(200).json({ url: session.url });

  } catch (error) {
    console.error("Error creating Stripe session:", error);
    res.status(500).json({ error: { message: "Failed to create payment session." } });
  }
}