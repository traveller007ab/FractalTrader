import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import tradeRoutes from './routes.js';
import { getConnection } from './metaApiConnection.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity in this example
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Pass the io instance to the routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/api', tradeRoutes);

const PORT = process.env.PORT || 3001;

io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Periodically fetch positions and broadcast them to all clients
const startPositionPolling = () => {
    setInterval(async () => {
        try {
            const connection = await getConnection();
            if (connection) {
                const positions = await connection.getPositions();
                const mappedPositions = positions.map(p => ({
                    id: p.id,
                    symbol: p.symbol,
                    side: p.type === 'POSITION_TYPE_BUY' ? 'buy' : 'sell',
                    volume: p.volume,
                    stopLoss: p.stopLoss,
                    takeProfit: p.takeProfit,
                    pnl: p.profit,
                    status: 'open'
                }));
                io.emit('positions_update', mappedPositions);
            }
        } catch (err) {
            console.error('Error polling positions:', err.message);
        }
    }, 5000); // Poll every 5 seconds per PRD
};

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Starting MetaAPI connection...');
  getConnection().then(() => {
      console.log('Initial MetaAPI connection successful. Starting position polling.');
      startPositionPolling();
  }).catch(err => {
      console.error('Failed to establish initial MetaAPI connection:', err.message);
  });
});
