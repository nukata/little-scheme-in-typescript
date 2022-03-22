// A little arithmetic in TypeScript 4.6 / Deno 1.20
//      R01.08.04/R04.03.21 by SUZUKI Hisao

export type Numeric = number | bigint;

// A Number value is treated as an inexact number.
// A BigInt value is treated as an exact number.
// Any intergers should be represented by BigInt if possible.
// If the runtime does not have BigInt, arithmetic will be done with Number.

// Is x a Numeric?
export function isNumeric(x: unknown): x is Numeric {
    const t = typeof x;
    return t === 'number' || t === 'bigint';
}

// x + y
export function add(x: Numeric, y: Numeric): Numeric {
    if (typeof x === 'number') {
        if (typeof y === 'number')
            return x + y;
        else
            return x + Number(y);
    } else {
        if (typeof y === 'number')
            return Number(x) + y;
        else
            return x + y;
    }
}

// x - y
export function subtract(x: Numeric, y: Numeric): Numeric {
    if (typeof x === 'number') {
        if (typeof y === 'number')
            return x - y;
        else
            return x - Number(y);
    } else {
        if (typeof y === 'number')
            return Number(x) - y;
        else
            return x - y;
    }
}

// x * y
export function multiply(x: Numeric, y: Numeric): Numeric {
    if (typeof x === 'number') {
        if (typeof y === 'number')
            return x * y;
        else
            return x * Number(y);
    } else {
        if (typeof y === 'number')
            return Number(x) * y;
        else
            return x * y;
    }
}

// Compare x and y.
// -1, 0 or 1 as x is less than, equal to, or greater than y.
export function compare(x: Numeric, y: Numeric): number {
    if (typeof x === 'number') {
        if (typeof y === 'number')
            return Math.sign(x - y);
        else
            return Math.sign(x - Number(y));
    } else {
        if (typeof y === 'number')
            return Math.sign(Number(x) - y);
        else
            return (x < y) ? -1 : (y < x) ? 1 : 0;
    }
}

// Try to parse the token as a Numeric or null.
export function tryToParse(token: string): Numeric | null {
    try {
        return BigInt(token);
    } catch (_ex) {
        const n = Number(token);
        if (isNaN(n))
            return null;
        return n;
    }
}

// Convert x to string.
export function convertToString(x: Numeric): string {
    const s = x + '';
    if (typeof BigInt !== 'undefined')
        if (typeof x === 'number')
            if (Number.isInteger(x) && !s.includes('e'))
                return s + '.0';    // 123.0 => '123.0'
    return s;
}
