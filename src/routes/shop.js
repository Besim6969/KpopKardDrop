const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const PRODUCTS = {
  booster_standard:  { name:'Pack Standard',  price:199,  coins:199  },
  booster_rare:      { name:'Pack Rare',       price:399,  coins:399  },
  booster_mythic:    { name:'Pack Mythique',   price:799,  coins:799  },
  booster_legendary: { name:'Pack Légendaire', price:1499, coins:1499 },
  coins_500:         { name:'500 KKD Coins',   price:499,  coins:500  },
  coins_1200:        { name:'1200 KKD Coins',  price:999,  coins:1200 },
  coins_2800:        { name:'2800 KKD Coins',  price:1999, coins:2800 },
  coins_6500:        { name:'6500 KKD Coins',  price:3999, coins:6500 },
};

router.get('/products', (req, res) => res.json(PRODUCTS));

router.post('/checkout', authMiddleware, async (req, res) => {
  const { productId } = req.body;
  const product = PRODUCTS[productId];
  if (!product) return res.status(400).json({ error: 'Produit invalide.' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: user.email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `KpopKardDrop — ${product.name}` },
          unit_amount: product.price,
        },
        quantity: 1,
      }],
      metadata: { userId: req.userId, productId, coins: String(product.coins) },
      success_url: `${process.env.FRONTEND_URL}/KpopKardDrop-Shop.html?success=1`,
      cancel_url:  `${process.env.FRONTEND_URL}/KpopKardDrop-Shop.html`,
    });
    res.json({ url: session.url });
  } catch(err) {
    res.status(500).json({ error: 'Erreur Stripe.' });
  }
});

module.exports = router;
