const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: 'Webhook invalide.' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, productId, coins, type, total } = session.metadata;

    try {
      if (type === 'kardpoints') {
        await prisma.user.update({
          where: { id: userId },
          data: {
            kardPoints:    { increment: parseInt(total) },
            totalKpEarned: { increment: parseInt(total) }
          }
        });
      } else {
        await prisma.user.update({
          where: { id: userId },
          data: { kkdCoins: { increment: parseInt(coins) } }
        });
      }

      await prisma.purchase.create({
        data: {
          userId,
          productId,
          amount: session.amount_total,
          status: 'completed'
        }
      });
    } catch(err) {
      console.error('Webhook error:', err);
    }
  }

  res.json({ received: true });
});

module.exports = router;
