// Fix: Define a minimal Deno namespace to provide types for Deno.env,
// resolving errors when the remote edge runtime types cannot be fetched.
declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
  };
}

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// This interface should be kept in sync with the frontend `types.ts` Signal interface.
interface Signal {
  signal_id: string;
  strategy: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  stop_loss: number;
  take_profit: number;
  confidence: number;
  timestamp: string;
}

/**
 * Formats a signal object into a human-readable string with Markdown for Telegram.
 * @param signal The signal object from the database.
 * @returns A formatted string ready to be sent to Telegram.
 */
function formatMessage(signal: Signal): string {
    const sideEmoji = signal.side === 'buy' ? '🟢' : '🔴';
    const sideText = signal.side.toUpperCase();
    const confidencePercent = (signal.confidence * 100).toFixed(1);

    // Helper to format prices with appropriate precision.
    const formatPrice = (price: number) => price > 100 ? price.toFixed(2) : price.toFixed(4);

    return `
🚨 *New Signal: ${signal.symbol}* 🚨

*Action:* ${sideEmoji} ${sideText}
*Entry:* \`${formatPrice(signal.price)}\`
*Stop Loss:* \`${formatPrice(signal.stop_loss)}\`
*Take Profit:* \`${formatPrice(signal.take_profit)}\`

*Confidence:* *${confidencePercent}%*
_Strategy: ${signal.strategy}_
    `.trim();
}

/**
 * Main server handler for the Edge Function.
 */
serve(async (req) => {
  // 1. Ensure the request is a POST request, as expected from a webhook.
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  try {
    // 2. Securely retrieve secrets from environment variables.
    // These must be set in the Supabase project settings.
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('Missing Telegram environment variables/secrets.');
      return new Response('Server configuration error: Missing Telegram secrets.', { status: 500 });
    }

    // 3. Parse the incoming webhook payload from Supabase.
    const payload = await req.json();
    
    // For an INSERT event, the new data is in the `record` property.
    const newSignal = payload.record as Signal;
    
    if (!newSignal || !newSignal.symbol) {
        console.warn('Webhook received invalid or empty payload:', payload);
        return new Response('Invalid payload', { status: 400 });
    }
    
    // 4. Format the signal data into a message.
    const messageText = formatMessage(newSignal);
    
    // 5. Construct and send the request to the Telegram Bot API.
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: messageText,
        parse_mode: 'Markdown', // Use Markdown for rich text formatting.
      }),
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Failed to send message to Telegram:', errorBody);
      return new Response(`Telegram API error: ${errorBody}`, { status: response.status });
    }
    
    // 6. Return a success response to the webhook.
    return new Response(JSON.stringify({ success: true, message: 'Signal sent to Telegram.' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
    
  } catch (error) {
    console.error('Unexpected error in Edge Function:', error);
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
})
