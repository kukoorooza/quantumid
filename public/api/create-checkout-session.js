// In folder: /api/
// File name: create-checkout-session.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { amount, productName } = req.body;

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'], // You can add more types from your Stripe dashboard
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
          },
          unit_amount: amount, // Amount in cents
        },
        quantity: 1, // We charge for the whole order as a single item
      }],
      // IMPORTANT: Make sure to create these pages on your site
      success_url: `${req.headers.origin}/success.html`,
      cancel_url: `${req.headers.origin}/`,
    });

    // Respond with the session URL, which the frontend will redirect to
    res.status(200).json({ url: session.url });

  } catch (error) {
    console.error("Error creating Stripe session:", error);
    res.status(500).json({ error: { message: "Failed to create payment session." } });
  }
}