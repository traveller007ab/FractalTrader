import express from 'express';
import { getConnection } from './metaApiConnection.js';

const router = express.Router();

// Middleware for handling async route errors
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /api/positions
router.get('/positions', asyncHandler(async (req, res) => {
    try {
        const connection = await getConnection();
        const positions = await connection.getPositions();
        
        const mappedPositions = positions.map(p => ({
            id: p.id,
            symbol: p.symbol,
            side: p.type === 'POSITION_TYPE_BUY' ? 'buy' : 'sell',
            volume: p.volume,
            stopLoss: p.stopLoss,
            takeProfit: p.takeProfit,
            pnl: p.profit,
            status: 'open' // getPositions only returns open positions
        }));

        res.status(200).json(mappedPositions);
    } catch (err) {
        console.error('Error fetching positions:', err.message);
        res.status(500).json({ message: 'Failed to fetch positions from MetaAPI' });
    }
}));

// POST /api/execute
router.post('/execute', asyncHandler(async (req, res) => {
    const { signal } = req.body;
    if (!signal) {
        return res.status(400).json({ message: 'Signal data is required.' });
    }

    try {
        const connection = await getConnection();
        const { symbol, side, size, stop_loss, take_profit, rationale } = signal;
        
        let result;
        const options = {
            comment: rationale || 'SignalFlow Execution'
        };

        if (side === 'buy') {
            result = await connection.createMarketBuyOrder(symbol, size, stop_loss, take_profit, options);
        } else {
            result = await connection.createMarketSellOrder(symbol, size, stop_loss, take_profit, options);
        }

        if (result.stringCode !== 'TRADE_RETCODE_DONE') {
            throw new Error(`Trade execution failed: ${result.stringCode}`);
        }

        res.status(200).json({ success: true, orderId: result.orderId, message: 'Trade executed successfully' });

    } catch (err) {
        console.error('Error executing trade:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Failed to execute trade' });
    }
}));


// POST /api/close/:positionId
router.post('/close/:positionId', asyncHandler(async (req, res) => {
    const { positionId } = req.params;
    if (!positionId) {
        return res.status(400).json({ message: 'Position ID is required.' });
    }

    try {
        const connection = await getConnection();
        await connection.closePosition(positionId);
        res.status(200).json({ success: true, message: 'Position closed successfully' });
    } catch (err) {
        console.error(`Error closing position ${positionId}:`, err.message);
        res.status(500).json({ success: false, message: err.message || 'Failed to close position' });
    }
}));

export default router;
