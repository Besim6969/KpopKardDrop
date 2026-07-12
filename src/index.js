require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/../'));



// Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/cards',       require('./routes/cards'));
app.use('/api/boosters',    require('./routes/boosters'));
app.use('/api/rewards',     require('./routes/rewards'));
app.use('/api/friends',     require('./routes/friends'));
app.use('/api/trades',      require('./routes/trades'));
app.use('/api/shop',        require('./routes/shop'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/kardpoints',  require('./routes/kardpoints'));
app.use('/api/webhooks',    require('./routes/webhooks'));

app.get('/health', (req, res) => res.json({ status: 'ok', app: 'KpopKardDrop' }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🎴 KpopKardDrop running on port ${PORT}`));
