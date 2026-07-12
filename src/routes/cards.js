const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const { rarity, group, search } = req.query;
    const where = {};
    if (rarity) where.rarity = rarity;
    if (group) where.groupName = group;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const cards = await prisma.card.findMany({ where, orderBy: { groupName: 'asc' } });
    res.json(cards);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/collection', authMiddleware, async (req, res) => {
  try {
    const collection = await prisma.userCard.findMany({
      where: { userId: req.userId },
      include: { card: true },
      orderBy: { obtainedAt: 'desc' }
    });
    res.json(collection.map(uc => ({ ...uc.card, quantity: uc.quantity, favorite: uc.favorite, owned: true })));
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/collection/:cardId/favorite', authMiddleware, async (req, res) => {
  try {
    const uc = await prisma.userCard.findUnique({
      where: { userId_cardId: { userId: req.userId, cardId: req.params.cardId } }
    });
    if (!uc) return res.status(404).json({ error: 'Carte non trouvée.' });
    const updated = await prisma.userCard.update({
      where: { userId_cardId: { userId: req.userId, cardId: req.params.cardId } },
      data: { favorite: !uc.favorite }
    });
    res.json({ favorite: updated.favorite });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
