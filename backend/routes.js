import express from 'express';
import fetch from 'node-fetch';
import { getConnection } from './metaApiConnection.js';

const router = express.Router();

// Middleware for handling async route errors
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};


// --- Proxy for Twelve Data API ---
// NOTE: For production, store this key securely as an environment variable.
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || 'aeb4fab6e1f34b2ea972fee5f909bb9e';
const BASE_URL = 'https://api.twelvedata.com';

// GET /api/timeseries - Secure proxy for Twelve Data
router.get('/timeseries', asyncHandler(async (req, res) => {
    const { symbol, interval, outputsize = '100' } = req.query;

    if (!symbol || !interval) {
        return res.status(400).json({ message: 'Symbol and interval query parameters are required.' });
    }

    try {
        const url = new URL(`${BASE_URL}/time_series`);
        url.searchParams.append('symbol', symbol);
        url.searchParams.append('interval', interval);
        url.searchParams.append('outputsize', outputsize);
        url.searchParams.append('apikey', TWELVE_DATA_API_KEY);

        const apiRes = await fetch(url.toString());
        const data = await apiRes.json();
        
        if (data.status === 'error') {
            throw new Error(`TwelveData API error: ${data.message}`);
        }

        if (!data.values || !Array.isArray(data.values)) {
            console.warn(`No time series values returned for ${symbol} from TwelveData.`);
            return res.json([]);
        }

        // Twelve Data returns newest first. App expects oldest first (chronological).
        const mappedData = data.values.map(item => ({
            datetime: new Date(item.datetime).toISOString(),
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseFloat(item.volume || '0'),
        })).reverse();

        res.status(200).json(mappedData);

    } catch (err) {
        console.error(`Error fetching from TwelveData for ${symbol} via backend:`, err.message);
        res.status(500).json({ message: err.message || 'Failed to fetch time series data' });
    }
}));


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
        const { symbol, side, size, stop_loss, take_profit } = signal;
        
        let result;
        // Simple options object
        const options = {
            comment: 'SignalFlow Execution'
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