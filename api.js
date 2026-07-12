// ══════════════════════════════════════
// KpopKardDrop — API Client Central
// Inclus dans toutes les pages HTML via <script src="api.js">
// ══════════════════════════════════════

const IS_PROD    = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
const PROD_URL   = 'https://kpopkarddrop.vercel.app'; // ← Remplace par ton URL Vercel
const API_URL    = IS_PROD ? `${PROD_URL}/api` : 'http://localhost:3001/api';
const SOCKET_URL = IS_PROD ? PROD_URL : 'http://localhost:3001';

// ══════════════════════════════════════
// TOKEN & SESSION
// ══════════════════════════════════════
const Auth = {
  getToken()          { return localStorage.getItem('kkd_token'); },
  setToken(t)         { localStorage.setItem('kkd_token', t); },
  removeToken()       { localStorage.removeItem('kkd_token'); localStorage.removeItem('kkd_user'); },
  getUser()           { try { return JSON.parse(localStorage.getItem('kkd_user')); } catch { return null; } },
  setUser(u)          { localStorage.setItem('kkd_user', JSON.stringify(u)); },
  isLoggedIn()        { return !!this.getToken(); },
  logout()            { this.removeToken(); window.location.href = 'KpopKardDrop.html'; },
};

// ══════════════════════════════════════
// HTTP CLIENT
// ══════════════════════════════════════
async function http(method, endpoint, body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && Auth.getToken()) headers['Authorization'] = `Bearer ${Auth.getToken()}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res  = await fetch(`${API_URL}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  } catch (err) {
    // Token expiré → déconnexion automatique
    if (err.message?.includes('Token invalide') || err.message?.includes('Token expiré')) {
      Auth.logout();
    }
    throw err;
  }
}

const GET    = (ep, auth=true)       => http('GET',    ep, null, auth);
const POST   = (ep, body, auth=true) => http('POST',   ep, body, auth);
const PUT    = (ep, body, auth=true) => http('PUT',    ep, body, auth);
const DELETE = (ep, auth=true)       => http('DELETE', ep, null, auth);

// ══════════════════════════════════════
// AUTH API
// ══════════════════════════════════════
const AuthAPI = {
  async register(email, username, password) {
    const data = await POST('/auth/register', { email, username, password }, false);
    Auth.setToken(data.token);
    Auth.setUser(data.user);
    return data;
  },
  async login(email, password) {
    const data = await POST('/auth/login', { email, password }, false);
    Auth.setToken(data.token);
    Auth.setUser(data.user);
    return data;
  },
  async me() {
    const data = await GET('/auth/me');
    Auth.setUser(data);
    return data;
  },
  async updateProfile(username, bio) {
    return PUT('/auth/me', { username, bio });
  },
};

// ══════════════════════════════════════
// CARDS API
// ══════════════════════════════════════
const CardsAPI = {
  getAll(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return GET(`/cards${params ? '?' + params : ''}`, false);
  },
  getCollection()              { return GET('/cards/collection'); },
  toggleFavorite(cardId)       { return PUT(`/cards/collection/${cardId}/favorite`, {}); },
};

// ══════════════════════════════════════
// BOOSTERS API
// ══════════════════════════════════════
const BoostersAPI = {
  open(packType)  { return POST('/boosters/open', { packType }); },
  getHistory()    { return GET('/boosters/history'); },
};

// ══════════════════════════════════════
// REWARDS API
// ══════════════════════════════════════
const RewardsAPI = {
  getStatus()     { return GET('/rewards/status'); },
  claimDaily()    { return POST('/rewards/daily', {}); },
  claimHourly()   { return POST('/rewards/hourly', {}); },
};

// ══════════════════════════════════════
// FRIENDS & CHAT API
// ══════════════════════════════════════
const FriendsAPI = {
  getAll()                      { return GET('/friends'); },
  getRequests()                 { return GET('/friends/requests'); },
  sendRequest(username)         { return POST('/friends/request', { username }); },
  respondRequest(id, accept)    { return PUT(`/friends/request/${id}`, { accept }); },
  getMessages(friendshipId)     { return GET(`/friends/messages/${friendshipId}`); },
};

// ══════════════════════════════════════
// TRADES API
// ══════════════════════════════════════
const TradesAPI = {
  getAll()                                              { return GET('/trades'); },
  propose(receiverId, offeredCardId, wantedCardId, msg) {
    return POST('/trades', { receiverId, offeredCardId, wantedCardId, message: msg });
  },
};

// ══════════════════════════════════════
// SHOP API
// ══════════════════════════════════════
const ShopAPI = {
  getProducts()                       { return GET('/shop/products', false); },
  checkout(productId, quantity = 1)   { return POST('/shop/checkout', { productId, quantity }); },
  getPurchases()                      { return GET('/shop/purchases'); },
};

// ══════════════════════════════════════
// USERS API
// ══════════════════════════════════════
const UsersAPI = {
  getLeaderboard()        { return GET('/users/leaderboard', false); },
  getProfile(username)    { return GET(`/users/${username}`, false); },
};

// ══════════════════════════════════════
// SOCKET.IO — TEMPS RÉEL
// ══════════════════════════════════════
let socket = null;

const Socket = {
  connect() {
    if (socket?.connected) return socket;
    // Charge Socket.IO depuis le CDN si pas encore chargé
    if (!window.io) {
      const s = document.createElement('script');
      s.src = 'https://cdn.socket.io/4.6.1/socket.io.min.js';
      s.onload = () => this._init();
      document.head.appendChild(s);
    } else {
      this._init();
    }
    return socket;
  },

  _init() {
    if (!Auth.getToken()) return;
    socket = io(SOCKET_URL, {
      auth: { token: Auth.getToken() },
      transports: ['websocket'],
    });
    socket.on('connect',    () => console.log('🔌 Socket connecté'));
    socket.on('disconnect', () => console.log('🔌 Socket déconnecté'));
    socket.on('error',      (e) => console.error('Socket error:', e));
  },

  disconnect() { socket?.disconnect(); socket = null; },

  // Envoyer un message
  sendMessage(friendshipId, content, cardShareId = null) {
    socket?.emit('message:send', { friendshipId, content, cardShareId });
  },

  // Proposer un échange
  proposeTrade(receiverId, offeredCardId, wantedCardId, message = '') {
    socket?.emit('trade:propose', { receiverId, offeredCardId, wantedCardId, message });
  },

  // Répondre à un échange
  respondTrade(tradeId, accept) {
    socket?.emit('trade:respond', { tradeId, accept });
  },

  // Typing indicators
  startTyping(friendshipId)  { socket?.emit('typing:start', { friendshipId }); },
  stopTyping(friendshipId)   { socket?.emit('typing:stop',  { friendshipId }); },

  // Écouteurs
  on(event, cb)  { socket?.on(event, cb); },
  off(event, cb) { socket?.off(event, cb); },
};

// ══════════════════════════════════════
// STRIPE — PAIEMENT
// ══════════════════════════════════════
const Stripe = {
  async redirectToCheckout(productId, quantity = 1) {
    try {
      UI.showLoader('Redirection vers le paiement...');
      const { url } = await ShopAPI.checkout(productId, quantity);
      window.location.href = url; // Redirection vers Stripe Checkout
    } catch (err) {
      UI.hideLoader();
      UI.toast(err.message, 'error');
    }
  },
};

// ══════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════
const UI = {
  // Toast notifications
  toast(msg, type = 'info', duration = 3000) {
    const existing = document.getElementById('kkd-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.id = 'kkd-toast';
    t.textContent = msg;
    const colors = {
      success: 'rgba(34,197,94,0.15)',
      error:   'rgba(255,45,120,0.15)',
      gold:    'rgba(255,215,0,0.1)',
      info:    'rgba(0,245,255,0.1)',
    };
    const borders = {
      success: 'rgba(34,197,94,0.3)',
      error:   'rgba(255,45,120,0.3)',
      gold:    'rgba(255,215,0,0.3)',
      info:    'rgba(0,245,255,0.25)',
    };
    const textColors = {
      success: '#22c55e', error: '#ff2d78',
      gold: '#ffd700',    info: '#00f5ff',
    };
    t.style.cssText = `
      position:fixed;bottom:28px;right:28px;z-index:9999;
      padding:14px 20px;border-radius:10px;font-size:0.82rem;
      font-family:'Noto Sans KR',sans-serif;max-width:320px;
      background:${colors[type]||colors.info};
      border:1px solid ${borders[type]||borders.info};
      color:${textColors[type]||textColors.info};
      backdrop-filter:blur(10px);
      animation:kkdToastIn 0.3s ease;
    `;
    if (!document.getElementById('kkd-toast-style')) {
      const style = document.createElement('style');
      style.id = 'kkd-toast-style';
      style.textContent = `@keyframes kkdToastIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`;
      document.head.appendChild(style);
    }
    document.body.appendChild(t);
    setTimeout(() => t.remove(), duration);
  },

  // Loader overlay
  showLoader(msg = 'Chargement...') {
    const existing = document.getElementById('kkd-loader');
    if (existing) return;
    const l = document.createElement('div');
    l.id = 'kkd-loader';
    l.innerHTML = `<div style="text-align:center"><div style="font-size:2rem;margin-bottom:12px;animation:spin 1s linear infinite">⏳</div><div style="font-size:0.85rem;color:#7878a0;font-family:\'Noto Sans KR\',sans-serif">${msg}</div></div>`;
    l.style.cssText = `position:fixed;inset:0;z-index:9998;background:rgba(5,5,8,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center`;
    if (!document.getElementById('kkd-spin-style')) {
      const s = document.createElement('style');
      s.id = 'kkd-spin-style';
      s.textContent = `@keyframes spin{to{transform:rotate(360deg)}}`;
      document.head.appendChild(s);
    }
    document.body.appendChild(l);
  },

  hideLoader() {
    document.getElementById('kkd-loader')?.remove();
  },

  // Met à jour le header utilisateur dans la sidebar
  updateSidebarUser(user) {
    const nameEl = document.querySelector('.user-name');
    const rankEl = document.querySelector('.user-rank');
    const avatarEl = document.querySelector('.user-avatar');
    if (nameEl)   nameEl.textContent = user.username;
    if (rankEl)   rankEl.textContent = `✦ Rang #${user.rank || '—'}`;
    if (avatarEl) avatarEl.textContent = user.username?.[0]?.toUpperCase() || 'K';
  },

  // Rareté
  rarityLabel:  { COMMON:'Commune', RARE:'Rare', MYTHIC:'Mythique', LEGENDARY:'Légendaire' },
  rarityIcon:   { COMMON:'🃏', RARE:'💎', MYTHIC:'✨', LEGENDARY:'👑' },
  rarityColor:  { COMMON:'#a0aec0', RARE:'#63b3ed', MYTHIC:'#c77dff', LEGENDARY:'#ffd700' },
};

// ══════════════════════════════════════
// GUARD — Redirige si non connecté
// ══════════════════════════════════════
function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'KpopKardDrop.html';
    return false;
  }
  return true;
}

// ══════════════════════════════════════
// INIT — Charge le user au démarrage
// ══════════════════════════════════════
(async function init() {
  if (Auth.isLoggedIn()) {
    try {
      const user = await AuthAPI.me();
      UI.updateSidebarUser(user);
    } catch {
      // Token invalide, on nettoie
      Auth.removeToken();
    }
  }
})();

// ══════════════════════════════════════
// EXPORT GLOBAL
// ══════════════════════════════════════
window.KKD = {
  Auth, AuthAPI, CardsAPI, BoostersAPI, RewardsAPI,
  FriendsAPI, TradesAPI, ShopAPI, UsersAPI,
  Socket, Stripe, UI, requireAuth,
};
