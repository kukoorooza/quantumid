// /api/create-checkout-session.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { line_items, customOrderDetails } = req.body;

    if (!line_items || !customOrderDetails) {
        return res.status(400).json({ error: { message: "Invalid order data provided." } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: line_items,
      // Attach the detailed order as a string in the metadata
      payment_intent_data: {
        metadata: {
            orderDetails: JSON.stringify(customOrderDetails)
        }
      },
      success_url: `${req.headers.origin}/success.html`,
      cancel_url: `${req.headers.origin}/`,
    });

    res.status(200).json({ url: session.url });

  } catch (error) {
    console.error("Error creating Stripe session:", error);
    res.status(500).json({ error: { message: "Failed to create payment session." } });
  }
}