/**
 * Formats a number into a short string using the Indian numbering system (Lakh/Crore).
 * 1,000 -> 1k
 * 1,00,000 -> 1 Lakh
 * 10,00,000 -> 10 Lakh
 * 1,00,00,000 -> 1 Cr
 */
export const formatIndianShort = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (isNaN(num) || num === 0) return '';

    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (absNum >= 10000000) {
        return `${sign}${(absNum / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
    }
    if (absNum >= 100000) {
        return `${sign}${(absNum / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Lakh`;
    }
    if (absNum >= 1000) {
        return `${sign}${(absNum / 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}k`;
    }

    return `${sign}${absNum.toLocaleString('en-IN')}`;
};

/**
 * Formats a number as Indian Currency (₹) with short notation.
 */
export const formatCurrencyShort = (amount: number | string): string => {
    const formatted = formatIndianShort(amount);
    return formatted ? `₹ ${formatted}` : '';
};
