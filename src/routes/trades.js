const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: {
        OR: [{ senderId: req.userId }, { receiverId: req.userId }]
      },
      include: {
        sender:   { select: { username: true } },
        receiver: { select: { username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(trades);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  const { receiverId, offeredCardId, wantedCardId, message } = req.body;
  try {
    const trade = await prisma.trade.create({
      data: { senderId: req.userId, receiverId, offeredCardId, wantedCardId, message }
    });
    res.json(trade);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { accept } = req.body;
  try {
    const trade = await prisma.trade.findUnique({ where: { id: req.params.id } });
    if (!trade) return res.status(404).json({ error: 'Échange non trouvé.' });
    if (trade.receiverId !== req.userId) return res.status(403).json({ error: 'Non autorisé.' });

    if (accept) {
      await prisma.$transaction([
        prisma.userCard.upsert({
          where: { userId_cardId: { userId: req.userId, cardId: trade.offeredCardId } },
          update: { quantity: { increment: 1 } },
          create: { userId: req.userId, cardId: trade.offeredCardId }
        }),
        prisma.userCard.upsert({
          where: { userId_cardId: { userId: trade.senderId, cardId: trade.wantedCardId } },
          update: { quantity: { increment: 1 } },
          create: { userId: trade.senderId, cardId: trade.wantedCardId }
        }),
        prisma.user.update({ where: { id: req.userId },     data: { kardPoints: { increment: 15 } } }),
        prisma.user.update({ where: { id: trade.senderId }, data: { kardPoints: { increment: 15 } } }),
      ]);
    }

    const updated = await prisma.trade.update({
      where: { id: req.params.id },
      data: { status: accept ? 'accepted' : 'rejected' }
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
