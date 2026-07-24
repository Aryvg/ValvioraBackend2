// Format large numbers to abbreviated strings (95k, 1.2M, 3B, 4T)
module.exports = function formatCount(n) {
    if (typeof n !== 'number') return n;
    const abs = Math.abs(n);
    if (abs >= 1e12) return `${+(n / 1e12).toFixed(2).replace(/\.00$/, '')}T`;
    if (abs >= 1e9) return `${+(n / 1e9).toFixed(2).replace(/\.00$/, '')}B`;
    if (abs >= 1e6) return `${+(n / 1e6).toFixed(2).replace(/\.00$/, '')}M`;
    if (abs >= 1e3) return `${+(n / 1e3).toFixed(2).replace(/\.00$/, '')}k`;
    return n;
};
