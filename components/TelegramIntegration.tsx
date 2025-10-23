import React, { useState } from 'react';
import { TelegramIcon, ChevronDownIcon } from './icons.tsx';

export const TelegramIntegration: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    const codeBlock = `
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

interface Signal { /* ... type definition ... */ }

function formatMessage(signal: Signal): string { /* ... formatting logic ... */ }

serve(async (req) => {
  // 1. Check method
  // 2. Get secrets from Deno.env
  // 3. Parse webhook payload
  // 4. Format message
  // 5. Send to Telegram API
  // 6. Return success/error response
})
`.trim();

    return (
        <div className="border-t border-border pt-6">
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="flex justify-between items-center w-full text-left focus:outline-none"
                aria-expanded={isOpen}
                aria-controls="telegram-integration-panel"
            >
                <div className="flex items-center gap-3">
                    <TelegramIcon className="w-6 h-6 text-accent" />
                    <h3 className="text-md font-semibold text-text-primary">Telegram Integration Setup</h3>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div 
                id="telegram-integration-panel"
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[1000px] mt-4' : 'max-h-0'}`}
            >
                <div className="text-xs text-text-secondary space-y-4">
                    <p>Follow these steps to receive real-time signal alerts in a Telegram chat.</p>
                    <ol className="list-decimal list-inside space-y-3 pl-2">
                        <li>
                            <strong>Create a Telegram Bot:</strong><br/>
                            Open Telegram, search for <code className="bg-bg-primary/50 text-text-primary p-1 rounded">@BotFather</code>, start a chat, and send <code className="bg-bg-primary/50 text-text-primary p-1 rounded">/newbot</code>. Follow the prompts to get your bot's API token.
                        </li>
                        <li>
                            <strong>Get your Chat ID:</strong><br/>
                            Search for <code className="bg-bg-primary/50 text-text-primary p-1 rounded">@userinfobot</code>, start a chat, and it will give you your numeric Chat ID. If sending to a channel, add your bot as an admin, send a message, then visit <code className="text-accent/80 text-[10px] break-all">https://api.telegram.org/bot&lt;YOUR_TOKEN&gt;/getUpdates</code> to find the channel's chat ID (it will be negative).
                        </li>
                        <li>
                            <strong>Set Supabase Secrets:</strong><br/>
                            In your Supabase project, go to <code className="bg-bg-primary/50 text-text-primary p-1 rounded">Settings &gt; Edge Functions</code>. Add two new secrets:
                            <ul className="list-disc pl-5 mt-1 space-y-1">
                                <li>Name: <code className="bg-bg-primary/50 text-text-primary p-1 rounded">TELEGRAM_BOT_TOKEN</code>, Value: <span className="italic">(Your token from BotFather)</span></li>
                                <li>Name: <code className="bg-bg-primary/50 text-text-primary p-1 rounded">TELEGRAM_CHAT_ID</code>, Value: <span className="italic">(Your chat ID)</span></li>
                            </ul>
                        </li>
                        <li>
                            <strong>Deploy the Edge Function:</strong><br/>
                            Using the Supabase CLI, create a function: <code className="bg-bg-primary/50 text-text-primary p-1 rounded">supabase functions new telegram-notifier</code>. Replace the file's contents with the code for the notifier, then deploy: <code className="bg-bg-primary/50 text-text-primary p-1 rounded">supabase functions deploy</code>.
                            <pre className="mt-2 bg-bg-primary/50 p-2 rounded-md text-text-secondary font-mono max-h-24 overflow-auto">{codeBlock}</pre>
                        </li>
                         <li>
                            <strong>Create Database Webhook:</strong><br/>
                            Go to <code className="bg-bg-primary/50 text-text-primary p-1 rounded">Database &gt; Webhooks</code>. Create a new webhook on the <code className="bg-bg-primary/50 text-text-primary p-1 rounded">signals</code> table, check the "Insert" event, and set the HTTP Request to your <code className="bg-bg-primary/50 text-text-primary p-1 rounded">telegram-notifier</code> function.
                        </li>
                    </ol>
                     <p className="pt-2 text-center text-text-muted">Once configured, every new signal generated will be sent to your Telegram chat instantly.</p>
                </div>
            </div>
        </div>
    );
};
