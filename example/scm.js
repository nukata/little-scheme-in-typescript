// A little arithmetic in TypeScript 3.7 by SUZUKI Hisao (R01.08.04/R01.11.13)
'use strict';
// A Number value is treated as an inexact number.
// A BigInt value is treated as an exact number.
// Any intergers should be represented by BigInt if possible.
// If the runtime does not have BigInt, arithmetic will be done with Number.
// Is x a Numeric?
function isNumeric(x) {
    let t = typeof x;
    return t === 'number' || t === 'bigint';
}
// x + y
function add(x, y) {
    if (typeof x === 'number') {
        if (typeof y === 'number')
            return x + y;
        else
            return x + Number(y);
    }
    else {
        if (typeof y === 'number')
            return Number(x) + y;
        else
            return x + y;
    }
}
// x - y
function subtract(x, y) {
    if (typeof x === 'number') {
        if (typeof y === 'number')
            return x - y;
        else
            return x - Number(y);
    }
    else {
        if (typeof y === 'number')
            return Number(x) - y;
        else
            return x - y;
    }
}
// x * y
function multiply(x, y) {
    if (typeof x === 'number') {
        if (typeof y === 'number')
            return x * y;
        else
            return x * Number(y);
    }
    else {
        if (typeof y === 'number')
            return Number(x) * y;
        else
            return x * y;
    }
}
// Compare x and y.
// -1, 0 or 1 as x is less than, equal to, or greater than y.
function compare(x, y) {
    if (typeof x === 'number') {
        if (typeof y === 'number')
            return Math.sign(x - y);
        else
            return Math.sign(x - Number(y));
    }
    else {
        if (typeof y === 'number')
            return Math.sign(Number(x) - y);
        else
            return (x < y) ? -1 : (y < x) ? 1 : 0;
    }
}
// Try to parse the token as a Numeric or null.
function tryToParse(token) {
    try {
        return BigInt(token);
    }
    catch (ex) {
        const n = Number(token);
        if (isNaN(n))
            return null;
        return n;
    }
}
// Convert x to string.
function convertToString(x) {
    let s = x + '';
    if (typeof BigInt !== 'undefined')
        if (typeof x === 'number')
            if (Number.isInteger(x) && !s.includes('e'))
                return s + '.0'; // 123.0 => '123.0'
    return s;
}
// A Little Scheme in TypeScript 3.8
//      v1.2 R01.08.01/R02.04.11 by SUZUKI Hisao
// $ tsc -strict -t ESNext --outFile scm.js scm.ts && node scm.js
/// <reference path="arith.ts" />
// Run the callback on the next event loop.
let runOnNextLoop = (callback) => {
    setTimeout(callback, 0);
};
// Read the whole file of fileName as a string.
let readStringFrom;
// Write the strig s (a new line on '\n').
let write;
// Set stdInOnData and stdInOnEnd as the callbacks of the standard-in.
//----------------------------------------------------------------------
// Cons cell
class Cell {
    constructor(car, cdr) {
        this.car = car;
        this.cdr = cdr;
    }
    // Yield car, cadr, caddr and so on.
    [Symbol.iterator]() {
        let j = this;
        return {
            next: () => {
                if (j === null) {
                    return {
                        done: true
                    };
                }
                else if (j instanceof Cell) {
                    let val = j.car;
                    j = j.cdr;
                    return {
                        done: false,
                        value: val
                    };
                }
                else {
                    throw new ImproperListException(j);
                }
            }
        };
    }
    // This is slightly faster than *[Symbol.iterator]() {... yield j.car ...}.
    // Length as a list
    get length() {
        let i = 0;
        for (const e of this)
            i++;
        return i;
    }
}
class ImproperListException extends Error {
    constructor(tail) {
        super();
        this.tail = tail;
    }
}
// The first element of list
function fst(x) {
    return x.car;
}
// The second element of list
function snd(x) {
    return x.cdr.car;
}
//----------------------------------------------------------------------
// Scheme's symbol
class Sym {
    // Construct a symbol that is not interned yet.
    constructor(name) {
        this.name = name;
    }
    toString() { return this.name; }
    // Construct an interned symbol.
    static interned(name) {
        let result = Sym.symbols[name];
        if (result === undefined) {
            result = new Sym(name);
            Sym.symbols[name] = result;
        }
        return result;
    }
}
// The table of interned symbols
Sym.symbols = {};
const QuoteSym = Sym.interned('quote');
const IfSym = Sym.interned('if');
const BeginSym = Sym.interned('begin');
const LambdaSym = Sym.interned('lambda');
const DefineSym = Sym.interned('define');
const SetQSym = Sym.interned('set!');
const ApplySym = Sym.interned('apply');
const CallCCSym = Sym.interned('call/cc');
//----------------------------------------------------------------------
// Linked list of bindings mapping symbols to values
class Environment {
    constructor(sym, val, next) {
        this.sym = sym;
        this.val = val;
        this.next = next;
    }
    // Yield each binding.
    [Symbol.iterator]() {
        let env = this;
        return {
            next: () => {
                if (env === null) {
                    return {
                        done: true,
                        value: this // XXX Just to suppress TS2532 error :-(
                    };
                }
                else {
                    let val = env;
                    env = env.next;
                    return {
                        done: false,
                        value: val
                    };
                }
            }
        };
    }
    // This is slightly faster than *[Symbol.iterator]() {... yield env ...}.
    // Search the bindings for a symbol.
    lookFor(sym) {
        for (const env of this)
            if (env.sym === sym)
                return env;
        throw ReferenceError(sym.toString());
    }
    // Build an environment by prepending the bindings of symbols and data.
    prependDefs(symbols, data) {
        if (symbols === null) {
            if (data !== null)
                throw Error('surplus arg: ' + stringify(data));
            return this;
        }
        else {
            if (data === null)
                throw Error('surplus param: ' + stringify(symbols));
            return new Environment(symbols.car, data.car, this.prependDefs(symbols.cdr, data.cdr));
        }
    }
}
//----------------------------------------------------------------------
// Operations in continuations
var ContOp;
(function (ContOp) {
    ContOp[ContOp["Then"] = 0] = "Then";
    ContOp[ContOp["Begin"] = 1] = "Begin";
    ContOp[ContOp["Define"] = 2] = "Define";
    ContOp[ContOp["SetQ"] = 3] = "SetQ";
    ContOp[ContOp["Apply"] = 4] = "Apply";
    ContOp[ContOp["ApplyFun"] = 5] = "ApplyFun";
    ContOp[ContOp["EvalArg"] = 6] = "EvalArg";
    ContOp[ContOp["ConsArgs"] = 7] = "ConsArgs";
    ContOp[ContOp["RestoreEnv"] = 8] = "RestoreEnv";
})(ContOp || (ContOp = {}));
// Scheme's continuation as a stack of steps
class Continuation {
    // Construct an empty continuation or a copy of another continuation.
    constructor(other) {
        this.stack = (other === undefined) ? [] : other.stack.slice();
    }
    // Copy steps from another continuation.
    copyFrom(other) {
        this.stack = other.stack.slice();
    }
    // Length of the continuation (an O(1) operation)
    get length() {
        return this.stack.length;
    }
    // Return a quasi-stack trace.
    toString() {
        const ss = [];
        for (const [op, val] of this.stack)
            ss.push(ContOp[op] + ' ' + stringify(val));
        return '$<' + ss.join('\n\t  ') + '>';
    }
    // Append a step to the top of the continuation.
    push(operation, value) {
        this.stack.push([operation, value]);
    }
    // Pop a step from the top of the continuation.
    pop() {
        const result = this.stack.pop();
        if (result === undefined)
            throw new Error('the continuation is empty.');
        return result;
    }
    // Push ContOp.RestoreEnv unless on a tail call.
    pushRestoreEnv(env) {
        const len = this.stack.length;
        if (len > 0)
            if (this.stack[len - 1][0] === ContOp.RestoreEnv)
                return; // tail call
        this.push(ContOp.RestoreEnv, env);
    }
}
//----------------------------------------------------------------------
// Lambda expression with its environment
class Closure {
    constructor(params, body, env) {
        this.params = params;
        this.body = body;
        this.env = env;
    }
}
// Built-in function
class Intrinsic {
    constructor(name, arity, fun) {
        this.name = name;
        this.arity = arity;
        this.fun = fun;
    }
    toString() {
        return '$<' + this.name + ':' + this.arity + '>';
    }
}
//----------------------------------------------------------------------
// Exception thrown by error procedure of SRFI-23
class ErrorException extends Error {
    constructor(reason, arg) {
        super(stringify(reason, false) + ': ' + stringify(arg));
    }
}
class EOFException extends Error {
    constructor() {
        super('unexpected EOF');
    }
}
// A unique value which means the expression has no value
const None = { toString: () => '#<VOID>' };
// A unique value which means the End Of File
const EOF = { toString: () => '#<EOF>' };
// A unique value which represents the call/cc procedure
const CallCCVal = { toString: () => '#<call/cc>' };
// A unique value which represents the apply procedure
const ApplyVal = { toString: () => '#<apply>' };
//----------------------------------------------------------------------
// Convert an expression to a string.
function stringify(exp, quote = true) {
    if (exp === null) {
        return '()';
    }
    else if (exp === true) {
        return '#t';
    }
    else if (exp === false) {
        return '#f';
    }
    else if (exp instanceof Cell) {
        const ss = [];
        try {
            for (const e of exp)
                ss.push(stringify(e, quote));
        }
        catch (ex) {
            if (ex instanceof ImproperListException) {
                ss.push('.');
                ss.push(stringify(ex.tail, quote));
            }
            else {
                throw ex;
            }
        }
        return '(' + ss.join(' ') + ')';
    }
    else if (exp instanceof Environment) {
        const ss = [];
        for (const e of exp)
            if (e === GlobalEnv) {
                ss.push('GlobalEnv');
                break;
            }
            else if (e.sym === null) { // frame marker
                ss.push('|');
            }
            else {
                ss.push(e.sym.toString());
            }
        return '#<' + ss.join(' ') + '>';
    }
    else if (exp instanceof Closure) {
        return '#<' + stringify(exp.params) +
            ':' + stringify(exp.body) +
            ':' + stringify(exp.env) + '>';
    }
    else if ((typeof exp === 'string') && quote) {
        return '"' + exp + '"';
    }
    else if (isNumeric(exp)) {
        return convertToString(exp);
    }
    else {
        return '' + exp;
    }
}
//----------------------------------------------------------------------
function c(name, arity, fun, next) {
    return new Environment(Sym.interned(name), new Intrinsic(name, arity, fun), next);
}
// Return a list of symbols of the global environment.
function globals(x) {
    let j = null;
    const env = GlobalEnv.next; // Skip the frame marker.
    if (env !== null)
        for (const e of env)
            j = new Cell(e.sym, j);
    return j;
}
let G1 = c('+', 2, x => add(fst(x), snd(x)), c('-', 2, x => subtract(fst(x), snd(x)), c('*', 2, x => multiply(fst(x), snd(x)), c('<', 2, x => compare(fst(x), snd(x)) < 0, c('=', 2, x => compare(fst(x), snd(x)) === 0, c('number?', 1, x => isNumeric(fst(x)), c('error', 2, x => {
    throw new ErrorException(fst(x), snd(x));
}, c('globals', 0, globals, null))))))));
// The global environment
const GlobalEnv = new Environment(null, // frame marker
null, c('car', 1, x => fst(x).car, c('cdr', 1, x => fst(x).cdr, c('cons', 2, x => new Cell(fst(x), snd(x)), c('eq?', 2, x => Object.is(fst(x), snd(x)), c('pair?', 1, x => fst(x) instanceof Cell, c('null?', 1, x => fst(x) === null, c('not', 1, x => fst(x) === false, c('list', -1, x => x, c('display', 1, x => {
    write(stringify(fst(x), false));
    return new Promise(resolve => {
        runOnNextLoop(() => resolve(None));
    });
}, c('newline', 0, x => {
    write('\n');
    return new Promise(resolve => {
        runOnNextLoop(() => resolve(None));
    });
}, c('read', 0, x => readExpression('', ''), c('eof-object?', 1, x => fst(x) === EOF, c('symbol?', 1, x => fst(x) instanceof Sym, new Environment(CallCCSym, CallCCVal, new Environment(ApplySym, ApplyVal, G1))))))))))))))));
//----------------------------------------------------------------------
// Evaluate an expression in an environment asynchronously.
async function evaluate(exp, env) {
    const k = new Continuation();
    try {
        for (;;) {
            for (;;) {
                if (exp instanceof Cell) {
                    const kar = exp.car;
                    const kdr = exp.cdr;
                    if (kar === QuoteSym) { // (quote e)
                        exp = kdr.car;
                        break;
                    }
                    else if (kar === IfSym) { // (if e1 e2 e3) or (if e1 e2)
                        exp = kdr.car;
                        k.push(ContOp.Then, kdr.cdr);
                    }
                    else if (kar === BeginSym) { // (begin e...)
                        exp = kdr.car;
                        if (kdr.cdr !== null)
                            k.push(ContOp.Begin, kdr.cdr);
                    }
                    else if (kar === LambdaSym) { // (lambda (v...) e...)
                        exp = new Closure(kdr.car, kdr.cdr, env);
                        break;
                    }
                    else if (kar === DefineSym) { // (define v e)
                        exp = snd(kdr);
                        k.push(ContOp.Define, kdr.car);
                    }
                    else if (kar === SetQSym) { // (set! v e)
                        exp = snd(kdr);
                        const v = kdr.car;
                        k.push(ContOp.SetQ, env.lookFor(v));
                    }
                    else { // (fun arg...)
                        exp = kar;
                        k.push(ContOp.Apply, kdr);
                    }
                }
                else if (exp instanceof Sym) {
                    exp = env.lookFor(exp).val;
                    break;
                }
                else {
                    break; // a number, #t, #f etc.
                }
            }
            Loop2: for (;;) {
                // write('_' + k.length);
                if (k.length === 0)
                    return exp;
                const [op, x] = k.pop();
                switch (op) {
                    case ContOp.Then: { // x is (e2) or (e2 e3).
                        const j = x;
                        if (exp === false) {
                            if (j.cdr === null) {
                                exp = None;
                                break;
                            }
                            else {
                                exp = snd(j); // e3
                                break Loop2;
                            }
                        }
                        else {
                            exp = j.car; // e2
                            break Loop2;
                        }
                    }
                    case ContOp.Begin: { // x is (e...).
                        const j = x;
                        if (j.cdr !== null) // Unless on a tail call...
                            k.push(ContOp.Begin, j.cdr);
                        exp = j.car;
                        break Loop2;
                    }
                    case ContOp.Define: // x is a variable name.
                        //if (env.sym !== null) throw Error('no frame marker');
                        env.next = new Environment(x, exp, env.next);
                        exp = None;
                        break;
                    case ContOp.SetQ: // x is an Environment.
                        x.val = exp;
                        exp = None;
                        break;
                    case ContOp.Apply:
                        // x is a list of args; exp is a function.
                        if (x === null) {
                            [exp, env] = applyFunction(exp, null, k, env);
                            if (exp instanceof Promise)
                                exp = await exp;
                            break;
                        }
                        else {
                            k.push(ContOp.ApplyFun, exp);
                            let j = x;
                            while (j.cdr !== null) {
                                k.push(ContOp.EvalArg, j.car);
                                j = j.cdr;
                            }
                            exp = j.car;
                            k.push(ContOp.ConsArgs, null);
                            break Loop2;
                        }
                    case ContOp.ConsArgs:
                        // x is a list of evaluated args (to be cdr);
                        // exp is a newly evaluated arg (to be car).
                        const args = new Cell(exp, x);
                        const [op2, exp2] = k.pop();
                        switch (op2) {
                            case ContOp.EvalArg: // exp2 is the next arg.
                                exp = exp2;
                                k.push(ContOp.ConsArgs, args);
                                break Loop2;
                            case ContOp.ApplyFun: // exp2 is a function.
                                [exp, env] = applyFunction(exp2, args, k, env);
                                if (exp instanceof Promise)
                                    exp = await exp;
                                break;
                            default:
                                throw Error('invalid operation: ' + op2);
                        }
                        break;
                    case ContOp.RestoreEnv: // x is an Environment.
                        env = x;
                        break;
                    default:
                        throw Error('invalid operation: ' + op);
                }
            } // end Loop2
        }
    }
    catch (ex) {
        if (ex instanceof ErrorException)
            throw ex;
        else if (k.length === 0)
            throw ex;
        const ex2 = new Error(ex + '\n\t' + stringify(k));
        if (typeof ex === 'object' && ex !== null) {
            const stack = ex.stack; // non-standard
            if (stack !== undefined)
                ex2.stack = ex2.message + stack;
        }
        throw ex2;
    }
}
// Apply a function to arguments.
function applyFunction(fun, arg, k, env) {
    for (;;)
        if (fun === CallCCVal) {
            k.pushRestoreEnv(env);
            fun = fst(arg);
            arg = new Cell(new Continuation(k), null);
        }
        else if (fun === ApplyVal) {
            fun = fst(arg);
            arg = snd(arg);
        }
        else {
            break;
        }
    if (fun instanceof Intrinsic) {
        if (fun.arity >= 0)
            if (arg === null ? fun.arity > 0 : arg.length !== fun.arity)
                throw Error('arity not matched: ' + fun + ' and ' +
                    stringify(arg));
        let result = fun.fun(arg);
        return [result, env];
    }
    else if (fun instanceof Closure) {
        k.pushRestoreEnv(env);
        k.push(ContOp.Begin, fun.body);
        return [None, new Environment(null, // frame marker
            null, fun.env.prependDefs(fun.params, arg))];
    }
    else if (fun instanceof Continuation) {
        k.copyFrom(fun);
        return [fst(arg), env];
    }
    else {
        throw Error('not a function: ' + stringify(fun) + ' with ' +
            stringify(arg));
    }
}
//----------------------------------------------------------------------
// Split a string into a list of tokens.
// For '(a 1)' it returns ['(', 'a', '1', ')'].
function splitStringIntoTokens(source) {
    const result = [];
    for (const line of source.split('\n')) {
        const x = [];
        const ss = [];
        let i = 0;
        for (const e of line.split('"')) {
            if (i % 2 === 0) {
                x.push(e);
            }
            else {
                ss.push('"' + e); // Store a string literal.
                x.push('#s');
            }
            i++;
        }
        let s = x.join(' ').split(';')[0]; // Ignore ;-comment.
        s = s.replace(/'/g, " ' ").replace(/\)/g, ' ) ').replace(/\(/g, ' ( ');
        for (const e of s.split(/\s+/))
            if (e === '#s') {
                const s = ss.shift();
                result.push(s);
            }
            else if (e !== '') {
                result.push(e);
            }
    }
    return result;
}
// Read an expression from tokens.
// Tokens will be left with the rest of the token strings, if any.
function readFromTokens(tokens) {
    const token = tokens.shift();
    switch (token) {
        case undefined:
            throw new EOFException();
        case '(':
            const z = new Cell(null, null);
            let y = z;
            while (tokens[0] !== ')') {
                if (tokens[0] === '.') {
                    tokens.shift();
                    y.cdr = readFromTokens(tokens);
                    if (tokens[0] !== ')') // XXX cf. TypeScript #33443
                        throw SyntaxError(') is expected');
                    break;
                }
                const e = readFromTokens(tokens);
                const x = new Cell(e, null);
                y.cdr = x;
                y = x;
            }
            tokens.shift();
            return z.cdr;
        case ')':
            throw SyntaxError('unexpected )');
        case "'":
            const e = readFromTokens(tokens);
            return new Cell(QuoteSym, new Cell(e, null)); // 'e => (quote e)
        case '#f':
            return false;
        case '#t':
            return true;
    }
    if (token[0] === '"') {
        return token.substring(1);
    }
    else {
        const n = tryToParse(token);
        if (n === null)
            return Sym.interned(token);
        return n;
    }
}
//----------------------------------------------------------------------
// Load a source code from a file asynchronously.
async function load(fileName) {
    const source = readStringFrom(fileName);
    const tokens = splitStringIntoTokens(source);
    let result = None;
    while (tokens.length > 0) {
        const exp = readFromTokens(tokens);
        result = await evaluate(exp, GlobalEnv);
    }
    return result; // Return the result of the last expression.
}
let stdInTokens = []; // Tokens from the standard-in
let oldTokens = [];
let readState = undefined;
// Read an expression from the standard-in asynchronously.
function readExpression(prompt1, prompt2) {
    oldTokens = stdInTokens.slice();
    try {
        return readFromTokens(stdInTokens);
    }
    catch (ex) {
        if (ex instanceof EOFException) {
            if (readState !== undefined)
                throw Error('bad read state');
            write(oldTokens.length === 0 ? prompt1 : prompt2);
            return new Promise((resolve, reject) => {
                readState = [resolve, reject, prompt1, prompt2];
                // Continue into stdInOnData/stdInOnEnd.
            });
        }
        else {
            stdInTokens = []; // Discard the erroneous tokens.
            throw ex;
        }
    }
}
function stdInOnData(line) {
    const tokens = splitStringIntoTokens(line);
    stdInTokens = oldTokens.concat(tokens);
    oldTokens = stdInTokens.slice();
    if (readState !== undefined) {
        const [resolve, reject, prompt1, prompt2] = readState;
        try {
            resolve(readFromTokens(stdInTokens));
            readState = undefined;
        }
        catch (ex) {
            if (ex instanceof EOFException) {
                write(oldTokens.length === 0 ? prompt1 : prompt2);
                // Continue into stdInOnData/stdInOnEnd.
            }
            else {
                stdInTokens = []; // Discard the erroneous tokens.
                reject(ex);
                readState = undefined;
            }
        }
    }
}
function stdInOnEnd() {
    if (readState !== undefined) {
        const [resolve, reject, prompt1, prompt2] = readState;
        resolve(EOF);
        readState = undefined;
    }
}
// Repeat Read-Eval-Print until End-Of-File asynchronously.
async function readEvalPrintLoop() {
    for (;;)
        try {
            const exp = await readExpression('> ', '| ');
            if (exp === EOF) {
                write("Goodbye\n");
                return;
            }
            const result = await evaluate(exp, GlobalEnv);
            if (result !== None)
                write(stringify(result) + '\n');
        }
        catch (ex) {
            write(ex + '\n');
        }
}
if (typeof setImmediate !== 'undefined')
    runOnNextLoop = setImmediate; // Use setImmediate if possible.
if (typeof process !== 'undefined' && typeof require !== 'undefined') {
    const fs = require('fs');
    readStringFrom = (fileName) => fs.readFileSync(fileName, 'utf8');
    write = (s) => process.stdout.write(s);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', stdInOnData);
    process.stdin.on('end', stdInOnEnd);
    async function main() {
        try {
            if (process.argv.length > 2) {
                await load(process.argv[2]);
                if (process.argv[3] !== '-')
                    process.exit(0);
            }
            await readEvalPrintLoop();
        }
        catch (ex) {
            console.log(ex);
            process.exit(1);
        }
    }
    main();
}
