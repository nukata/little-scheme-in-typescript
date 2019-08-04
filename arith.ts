// A little arithmetic in TypeScript 3.5/Node 12
//  R01.08.04 by SUZUKI Hisao

'use strict'

type Numeric = number | bigint;

// A Number value is treated as an inexact number.
// A BigInt value is treated as an exact number.
// Any intergers must be represented as BigInt.

// x + y
function add(x: Numeric, y: Numeric): Numeric {
    if (typeof x == 'number') {
        if (typeof y == 'number')
            return x + y;
        else
            return x + Number(y);
    } else {
        if (typeof y == 'number')
            return Number(x) + y;
        else
            return x + y;
    }
}

// x - y
function subtract(x: Numeric, y: Numeric): Numeric {
    if (typeof x == 'number') {
        if (typeof y == 'number')
            return x - y;
        else
            return x - Number(y);
    } else {
        if (typeof y == 'number')
            return Number(x) - y;
        else
            return x - y;
    }
}

// x * y
function multiply(x: Numeric, y: Numeric): Numeric {
    if (typeof x == 'number') {
        if (typeof y == 'number')
            return x * y;
        else
            return x * Number(y);
    } else {
        if (typeof y == 'number')
            return Number(x) * y;
        else
            return x * y;
    }
}

// Compare x and y.
// -1, 0 or 1 as x is less than, equal to, or greater than y.
function compare(x: Numeric, y: Numeric): number {
    if (typeof x == 'number') {
        if (typeof y == 'number')
            return Math.sign(x - y);
        else
            return Math.sign(x - Number(y));
    } else {
        if (typeof y == 'number')
            return Math.sign(Number(x) - y);
        else
            return (x < y) ? -1 : (y < x) ? 1 : 0;
    }
}

// Try to parse the token as a Numeric or null.
function tryToParse(token: string): Numeric | null {
    try {
        return BigInt(token);
    } catch (ex) {
        const n = Number(token);
        if (isNaN(n))
            return null;
        return n;
    }
}
