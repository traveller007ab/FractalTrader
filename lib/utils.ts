// Helper to extract symbol from filename
export const getSymbolFromFilename = (filename: string): string => {
    const name = filename.toUpperCase().replace('.CSV', '');
    // Basic replacements, can be expanded
    if (name.includes('BTCUSD') || name.includes('BTC-USD')) return 'BTC/USD';
    if (name.includes('ETHUSD') || name.includes('ETH-USD')) return 'ETH/USD';
    if (name.includes('XAUUSD') || name.includes('GOLD')) return 'XAU/USD';
    if (name.includes('SOLUSD') || name.includes('SOL-USD')) return 'SOL/USD';
    return 'BTC/USD'; // Default fallback
}