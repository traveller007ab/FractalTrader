// This client interacts with the backend server, which securely handles the MetaAPI SDK.
import type { Signal, LivePosition } from '../types';

// In a real deployment, this URL should be configured via environment variables.
const API_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';

async function handleResponse(response: Response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
}

export const metaApi = {
    async getPositions(): Promise<LivePosition[]> {
        console.log('[MetaAPI Client] Fetching positions from backend...');
        const response = await fetch(`${API_URL}/positions`);
        return handleResponse(response);
    },

    async executeTrade(signal: Signal): Promise<{ success: boolean; orderId?: string; message: string }> {
        console.log('[MetaAPI Client] Sending execution request for signal:', signal);
        const response = await fetch(`${API_URL}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signal })
        });
        return handleResponse(response);
    },

    async closePosition(positionId: string): Promise<{ success: boolean; message: string }> {
        console.log(`[MetaAPI Client] Sending close request for position ${positionId}...`);
        const response = await fetch(`${API_URL}/close/${positionId}`, {
            method: 'POST'
        });
        return handleResponse(response);
    }
};