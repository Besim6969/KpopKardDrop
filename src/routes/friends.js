const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ user1Id: req.userId }, { user2Id: req.userId }],
        status: 'accepted'
      },
      include: { user1: { select: { id:true, username:true } }, user2: { select: { id:true, username:true } } }
    });
    const friends = friendships.map(f => ({
      friendshipId: f.id,
      friend: f.user1Id === req.userId ? f.user2 : f.user1
    }));
    res.json(friends);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/request', authMiddleware, async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { username: req.body.username } });
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    if (target.id === req.userId) return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même.' });
    const friendship = await prisma.friendship.create({
      data: { user1Id: req.userId, user2Id: target.id, status: 'pending' }
    });
    res.json(friendship);
  } catch {
    res.status(400).json({ error: 'Demande déjà envoyée.' });
  }
});

router.put('/request/:id', authMiddleware, async (req, res) => {
  try {
    const { accept } = req.body;
    const friendship = await prisma.friendship.update({
      where: { id: req.params.id },
      data: { status: accept ? 'accepted' : 'rejected' }
    });
    res.json(friendship);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/messages/:friendshipId', authMiddleware, async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { friendshipId: req.params.friendshipId },
      include: { sender: { select: { username: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50
    });
    res.json(messages);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
