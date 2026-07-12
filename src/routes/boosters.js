const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const PACK_PRICES = { standard:199, rare:399, mythic:799, legendary:1499 };
const RARITY_WEIGHTS = {
  standard:  { COMMON:70, RARE:25, MYTHIC:4,  LEGENDARY:1  },
  rare:      { COMMON:40, RARE:45, MYTHIC:12, LEGENDARY:3  },
  mythic:    { COMMON:10, RARE:35, MYTHIC:45, LEGENDARY:10 },
  legendary: { COMMON:0,  RARE:20, MYTHIC:45, LEGENDARY:35 },
};

function pickRarity(weights) {
  const total = Object.values(weights).reduce((a,b) => a+b, 0);
  let rand = Math.random() * total;
  for (const [rarity, weight] of Object.entries(weights)) {
    rand -= weight;
    if (rand <= 0) return rarity;
  }
  return 'COMMON';
}

router.post('/open', authMiddleware, async (req, res) => {
  const { packType } = req.body;
  const price = PACK_PRICES[packType];
  if (!price) return res.status(400).json({ error: 'Type de pack invalide.' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (user.kkdCoins < price) return res.status(402).json({ error: 'Pas assez de KKD Coins.' });

    const weights = RARITY_WEIGHTS[packType];
    const drawnCards = [];

    for (let i = 0; i < 5; i++) {
      const rarity = pickRarity(weights);
      const cards = await prisma.card.findMany({ where: { rarity }, take: 20 });
      const card = cards[Math.floor(Math.random() * cards.length)];
      if (card) drawnCards.push(card);
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { kkdCoins: { decrement: price }, kardPoints: { increment: 5 } }
    });

    for (const card of drawnCards) {
      await prisma.userCard.upsert({
        where: { userId_cardId: { userId: req.userId, cardId: card.id } },
        update: { quantity: { increment: 1 } },
        create: { userId: req.userId, cardId: card.id }
      });
    }

    const updatedUser = await prisma.user.findUnique({ where: { id: req.userId } });
    res.json({ cards: drawnCards, newBalance: updatedUser.kkdCoins, kardPoints: updatedUser.kardPoints });
  } catch(err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
