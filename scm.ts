// A Little Scheme in TypeScript 4.6 / Deno 1.20
//      v2.0 R01.08.01/R04.03.22 by SUZUKI Hisao
//   $ tsc --strict -t es2020 scm.ts && deno run scm.js
// | $ deno run scm.ts
// | $ deno bundle scm.ts scm.js && deno run scm.js

'use strict';

import {
    Numeric, isNumeric, add, subtract, multiply, compare, tryToParse,
    convertToString
// @ts-ignore error TS2691 -- Deno needs the suffix here.
} from "./arith.ts";

// Run the callback on the next event loop.
let runOnNextLoop = (callback: () => void) => {
    setTimeout(callback, 0);
};

// Read the whole file of fileName as a string.
let readStringFrom: (fileName: string) => string;

// Write the strig s (and a new line on '\n').
let write: (s: string) => void;

// Read a line as a string, or null when End-Of-File is read.
let readLine: () => Promise<string | null>;

//----------------------------------------------------------------------

// Cons cell
class Cell {
    constructor(public readonly car: unknown,
                public cdr: unknown) {}

    // Yield car, cadr, caddr and so on.
    *[Symbol.iterator]() {
        let j: unknown = this;
        while (j instanceof Cell) {
            yield j.car;
            j = j.cdr;
        }
        if (j !== null)
            throw new ImproperListException(j);
    }

    // Length as a list
    get length(): number {
        let i = 0;
        for (const _e of this) i++;
        return i;
    }
}

class ImproperListException extends Error {
    constructor(public readonly tail: unknown) {
        super();
    }
}

// Scheme's list
type List = Cell | null;

// The first element of list
function fst(x: List): unknown {
    return (x as Cell).car;
}

// The second element of list
function snd(x: List): unknown {
    return ((x as Cell).cdr as Cell).car;
}

//----------------------------------------------------------------------

// Scheme's symbol
class Sym {
    // Construct a symbol that is not interned yet.
    private constructor(private readonly name: string) {}

    toString(): string { return this.name; }

    // The table of interned symbols
    private static symbols: {[name: string]: Sym} = {};

    // Construct an interned symbol.
    static interned(name: string): Sym {
        let result = Sym.symbols[name];
        if (result === undefined) {
            result = new Sym(name);
            Sym.symbols[name] = result;
        }
        return result;
    }
}

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
    constructor(public readonly sym: Sym | null,
                public val: unknown,
                public next: Environment | null) {}

    // Yield each binding.
    *[Symbol.iterator]() {
        let env: Environment | null = this;
        while (env !== null) {
            yield env;
            env = env.next;
        }
    }

    // Search the bindings for a symbol.
    lookFor(sym: Sym): Environment {
        for (const env of this)
            if (env.sym === sym)
                return env;
        throw ReferenceError(sym.toString());
    }

    // Build an environment by prepending the bindings of symbols and data.
    prependDefs(symbols: List, data: List): Environment {
        if (symbols === null) {
            if (data !== null)
                throw Error('surplus arg: ' + stringify(data));
            return this;
        } else {
            if (data === null)
                throw Error('surplus param: ' + stringify(symbols));
            return new Environment(symbols.car as Sym,
                                   data.car,
                                   this.prependDefs(symbols.cdr as List,
                                                    data.cdr as List));
        }
    }
}

//----------------------------------------------------------------------

// Operations in continuations
enum ContOp {
    Then,
    Begin,
    Define,
    SetQ,
    Apply,
    ApplyFun,
    EvalArg,
    ConsArgs,
    RestoreEnv
}

// Scheme's continuation as a stack of steps
class Continuation {
    private stack: Array<[ContOp, unknown]>;

    // Construct an empty continuation or a copy of another continuation.
    constructor(other?: Continuation) {
        this.stack = (other === undefined) ? [] : other.stack.slice();
    }

    // Copy steps from another continuation.
    copyFrom(other: Continuation): void {
        this.stack = other.stack.slice();
    }

    // Length of the continuation (an O(1) operation)
    get length(): number {
        return this.stack.length;
    }

    // Return a quasi-stack trace.
    toString(): string {
        const ss: string[] = [];
        for (const [op, val] of this.stack)
            ss.push(ContOp[op] + ' ' + stringify(val));
        return '$<' + ss.join('\n\t  ') + '>';
    }

    // Append a step to the top of the continuation.
    push(operation: ContOp, value: unknown): void {
        this.stack.push([operation, value]);
    }

    // Pop a step from the top of the continuation.
    pop(): [ContOp, unknown] {
        const result = this.stack.pop();
        if (result === undefined)
            throw new Error('the continuation is empty.');
        return result;
    }

    // Push ContOp.RestoreEnv unless on a tail call.
    pushRestoreEnv(env: Environment) {
        const len = this.stack.length;
        if (len > 0)
            if (this.stack[len - 1][0] === ContOp.RestoreEnv)
                return;         // tail call
        this.push(ContOp.RestoreEnv, env);
    }
}

//----------------------------------------------------------------------

// Lambda expression with its environment
class Closure {
    constructor(public readonly params: List,
                public readonly body: Cell,
                public readonly env: Environment) {}
}

type IntrinsicBody = (args: List) => unknown;

// Built-in function
class Intrinsic {
    constructor(public readonly name: string,
                public readonly arity: number,
                public readonly fun: IntrinsicBody) {}

    toString(): string {
        return '$<' + this.name + ':' + this.arity + '>';
    }
}
    
//----------------------------------------------------------------------

// Exception thrown by error procedure of SRFI-23
class ErrorException extends Error {
    constructor(reason: unknown, arg: unknown) {
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
function stringify(exp: unknown, quote=true): string {
    if (exp === null) {
        return '()';
    } else if (exp === true) {
        return '#t';
    } else if (exp === false) {
        return '#f';
    } else if (exp instanceof Cell) {
        const ss: string[] = [];
        try {
            for (const e of exp)
                ss.push(stringify(e, quote));
        } catch (ex) {
            if (ex instanceof ImproperListException) {
                ss.push('.');
                ss.push(stringify(ex.tail, quote));
            } else {
                throw ex;
            }
        }
        return '(' + ss.join(' ') + ')';
    } else if (exp instanceof Environment) {
        const ss: string[] = [];
        for (const e of exp)
            if (e === GlobalEnv) {
                ss.push('GlobalEnv');
                break;
            } else if (e.sym === null) { // frame marker
                ss.push('|');
            } else {
                ss.push(e.sym.toString());
            }
        return '#<' + ss.join(' ') + '>';
    } else if (exp instanceof Closure) {
        return '#<' + stringify(exp.params) +
            ':' + stringify(exp.body) +
            ':' + stringify(exp.env) + '>';
    } else if ((typeof exp === 'string') && quote) {
        return '"' + exp + '"';
    } else if (isNumeric(exp)) {
        return convertToString(exp);
    } else {
        return '' + exp;
    }
}

//----------------------------------------------------------------------

function c(name: string, arity: number, fun: IntrinsicBody,
           next: Environment | null) {
    return new Environment(Sym.interned(name),
                           new Intrinsic(name, arity, fun),
                           next);
}

// Return a list of symbols of the global environment.
function globals(_x: List) {
    let j: List = null;
    const env = GlobalEnv.next; // Skip the frame marker.
    if (env !== null)
        for (const e of env)
            j = new Cell(e.sym, j);
    return j;
}
 
const G1 =
    c('+', 2, x => add(fst(x) as Numeric, snd(x) as Numeric),
      c('-', 2, x => subtract(fst(x) as Numeric, snd(x) as Numeric),
        c('*', 2, x => multiply(fst(x) as Numeric, snd(x) as Numeric),
          c('<', 2, x => compare(fst(x) as Numeric, snd(x) as Numeric) < 0,
            c('=', 2, x => compare(fst(x) as Numeric, snd(x) as Numeric) === 0,
              c('number?', 1, x => isNumeric(fst(x)),
                c('error', 2, x => {
                    throw new ErrorException(fst(x), snd(x));
                },
                  c('globals', 0, globals,
                    null))))))));

// The global environment
const GlobalEnv = new Environment(
    null,                       // frame marker
    null,
    c('car', 1, x => (fst(x) as Cell).car,
      c('cdr', 1, x => (fst(x) as Cell).cdr,
        c('cons', 2, x => new Cell(fst(x), snd(x)),
          c('eq?', 2, x => Object.is(fst(x), snd(x)),
            c('pair?', 1, x => fst(x) instanceof Cell,
              c('null?', 1, x => fst(x) === null,
                c('not', 1, x => fst(x) === false,
                  c('list', -1, x => x,
                    c('display', 1, x => {
                        write(stringify(fst(x), false));
                        return new Promise(resolve => {
                            runOnNextLoop(() => resolve(None));
                        });
                    },
                      c('newline', 0, _x => {
                          write('\n');
                          return new Promise(resolve => {
                              runOnNextLoop(() => resolve(None));
                          });
                      },
                        c('read', 0, _x => readExpression('', ''),
                          c('eof-object?', 1, x => fst(x) === EOF,
                            c('symbol?', 1, x => fst(x) instanceof Sym,
                              new Environment(
                                  CallCCSym,
                                  CallCCVal,
                                  new Environment(
                                      ApplySym,
                                      ApplyVal,
                                      G1))))))))))))))));

//----------------------------------------------------------------------

// Evaluate an expression in an environment asynchronously.
async function evaluate(exp: unknown, env: Environment): Promise<unknown> {
    const k = new Continuation();
    try {
        for (;;) {
            for (;;) {
                if (exp instanceof Cell) {
                    const kar = exp.car;
                    const kdr = exp.cdr as Cell;
                    if (kar === QuoteSym) { // (quote e)
                        exp = kdr.car;
                        break;
                    } else if (kar === IfSym) { // (if e1 e2 e3) or (if e1 e2)
                        exp = kdr.car;
                        k.push(ContOp.Then, kdr.cdr);
                    } else if (kar ===  BeginSym) { // (begin e...)
                        exp = kdr.car;
                        if (kdr.cdr !== null)
                            k.push(ContOp.Begin, kdr.cdr);
                    } else if (kar === LambdaSym) { // (lambda (v...) e...)
                        exp = new Closure(kdr.car as Cell,
                                          kdr.cdr as Cell, env);
                        break;
                    } else if (kar === DefineSym) { // (define v e)
                        exp = snd(kdr);
                        k.push(ContOp.Define, kdr.car);
                    } else if (kar === SetQSym) { // (set! v e)
                        exp = snd(kdr);
                        const v = kdr.car as Sym;
                        k.push(ContOp.SetQ, env.lookFor(v));
                    } else {    // (fun arg...)
                        exp = kar;
                        k.push(ContOp.Apply, kdr);
                    }
                } else if (exp instanceof Sym) {
                    exp = env.lookFor(exp).val;
                    break;
                } else {
                    break;      // a number, #t, #f etc.
                }
            }
            Loop2:
            for (;;) {
                // write('_' + k.length);
                if (k.length === 0)
                    return exp;
                const [op, x] = k.pop();
                switch (op) {
                case ContOp.Then: { // x is (e2) or (e2 e3).
                    const j = x as Cell;
                    if (exp === false) {
                        if (j.cdr === null) {
                            exp = None;
                            break;
                        } else {
                            exp = snd(j); // e3
                            break Loop2;
                        }
                    } else {
                        exp = j.car; // e2
                        break Loop2;
                    }
                }
                case ContOp.Begin: { // x is (e...).
                    const j = x as Cell;
                    if (j.cdr !== null) // Unless on a tail call...
                        k.push(ContOp.Begin, j.cdr);
                    exp = j.car;
                    break Loop2;
                }
                case ContOp.Define: // x is a variable name.
                    //if (env.sym !== null) throw Error('no frame marker');
                    env.next = new Environment(x as Sym, exp, env.next);
                    exp = None;
                    break;
                case ContOp.SetQ: // x is an Environment.
                    (x as Environment).val = exp;
                    exp = None;
                    break;
                case ContOp.Apply:
                    // x is a list of args; exp is a function.
                    if (x === null) {
                        [exp, env] = applyFunction(exp, null, k, env);
                        if (exp instanceof Promise)
                            exp = await exp;
                        break;
                    } else {
                        k.push(ContOp.ApplyFun, exp);
                        let j = x as Cell;
                        while (j.cdr !== null) {
                            k.push(ContOp.EvalArg, j.car);
                            j = j.cdr as Cell;
                        }
                        exp = j.car;
                        k.push(ContOp.ConsArgs, null);
                        break Loop2;
                    }
                case ContOp.ConsArgs: {
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
                }
                case ContOp.RestoreEnv: // x is an Environment.
                    env = x as Environment;
                    break;
                default:
                    throw Error('invalid operation: ' + op);
                }
            } // end Loop2
        }
    } catch (ex) {
        if (ex instanceof ErrorException)
            throw ex;
        else if (k.length === 0)
            throw ex;
        const ex2 = new Error(ex + '\n\t' + stringify(k));
        if (typeof ex === 'object' && ex !== null) {
            const stack = (ex as any).stack; // .stack is not in the standards.
            if (stack !== undefined)
                ex2.stack = ex2.message + stack;
        }
        throw ex2;
    }
}

// Apply a function to arguments.
function applyFunction(fun: unknown, arg: List, k: Continuation,
                       env: Environment): [unknown, Environment]
{
    for (;;)
        if (fun === CallCCVal) {
            k.pushRestoreEnv(env);
            fun = fst(arg);
            arg = new Cell(new Continuation(k), null);
        } else if (fun === ApplyVal) {
            fun = fst(arg);
            arg = snd(arg) as List;
        } else {
            break;
        }
    if (fun instanceof Intrinsic) {
        if (fun.arity >= 0)
            if (arg === null ? fun.arity > 0 : arg.length !== fun.arity)
                throw Error('arity not matched: ' + fun + ' and ' +
                            stringify(arg));
        const result = fun.fun(arg);
        return [result, env];
    } else if (fun instanceof Closure) {
        k.pushRestoreEnv(env);
        k.push(ContOp.Begin, fun.body);
        return [None, new Environment(null, // frame marker
                                      null,
                                      fun.env.prependDefs(fun.params, arg))];
    } else if (fun instanceof Continuation) {
        k.copyFrom(fun);
        return [fst(arg), env];
    } else {
        throw Error('not a function: ' + stringify(fun) + ' with ' +
                    stringify(arg));
    }
}

//----------------------------------------------------------------------

// Split a string into a list of tokens.
// For '(a 1)' it returns ['(', 'a', '1', ')'].
function splitStringIntoTokens(source: string): string[] {
    const result: string[] = [];
    for (const line of source.split('\n')) {
        const x: string[] = [];
        const ss: string[] = [];
        let i = 0;
        for (const e of line.split('"')) {
            if (i % 2 === 0) {
                x.push(e);
            } else {
                ss.push('"' + e); // Store a string literal.
                x.push('#s');
            }
            i++;
        }
        let s = x.join(' ').split(';')[0]; // Ignore ;-comment.
        s = s.replace(/'/g, " ' ").replace(/\)/g, ' ) ').replace(/\(/g, ' ( ');
        for (const e of s.split(/\s+/))
            if (e === '#s') {
                const s = ss.shift() as string;
                result.push(s);
            } else if (e !== '') {
                result.push(e);
            }
    }
    return result;
}

// Read an expression from tokens.
// Tokens will be left with the rest of the token strings, if any.
function readFromTokens(tokens: string[]): unknown {
    const token = tokens.shift();
    switch (token) {
    case undefined:
        throw new EOFException();
    case '(': {
        const z = new Cell(null, null);
        let y = z;
        while (tokens[0] !== ')') {
            if (tokens[0] === '.') {
                tokens.shift();
                y.cdr = readFromTokens(tokens);
                if (tokens[0] as string !== ')') // XXX cf. TypeScript #33443
                    throw SyntaxError(') is expected');
                break
            }
            const e = readFromTokens(tokens);
            const x = new Cell(e, null);
            y.cdr = x;
            y = x;
        }
        tokens.shift();
        return z.cdr;
    }
    case ')':
        throw SyntaxError('unexpected )');
    case "'": {
        const e = readFromTokens(tokens);
        return new Cell(QuoteSym, new Cell(e, null)); // 'e => (quote e)
    }
    case '#f':
        return false;
    case '#t':
        return true;
    case '+':                // N.B. BigInt('+') returns 0n in Safari.
    case '-':
        return Sym.interned(token);
    }
    if (token[0] === '"') {
        return token.substring(1);
    } else {
        const n = tryToParse(token);
        if (n === null)
            return Sym.interned(token);
        return n;
    }
}

//----------------------------------------------------------------------

// Load a source code from a file asynchronously.
async function load(fileName: string): Promise<unknown> {
    const source = readStringFrom(fileName);
    const tokens = splitStringIntoTokens(source);
    let result: unknown = None;
    while (tokens.length > 0) {
        const exp = readFromTokens(tokens);
        result = await evaluate(exp, GlobalEnv);
    }
    return result;        // Return the result of the last expression.
}

let stdInTokens: string[] = []; // Tokens from the standard-in

// Read an expression from the standard-in asynchronously.
async function readExpression(prompt1: string, prompt2: string):
Promise<unknown> {
    for (;;) {
        const old = stdInTokens.slice();
        try {
            return readFromTokens(stdInTokens);
        } catch (ex) {
            if (ex instanceof EOFException) {
                write(old.length === 0 ? prompt1 : prompt2);
                const line = await readLine();
                if (line === null)
                    return EOF;
                const tokens = splitStringIntoTokens(line);
                stdInTokens = old.concat(tokens);
            } else {
                stdInTokens = []; // Discard the erroneous tokens.
                throw ex;
            }
        }
    }
}

// Repeat Read-Eval-Print until End-Of-File asynchronously.
async function readEvalPrintLoop(): Promise<void> {
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
        } catch (ex) {
            write(ex + '\n');
        }
}

//----------------------------------------------------------------------

// The main procedure on Deno

declare let Deno: any;          // XXX to transpile with tsc.
if (typeof Deno !== 'undefined') {
    runOnNextLoop = queueMicrotask;
    readStringFrom = Deno.readTextFileSync; // Requires allow-read permission.
    
    const encoder = new TextEncoder(); // to utf-8 bytes
    write = (s: string) => {
        const bb = encoder.encode(s);
        Deno.writeAllSync(Deno.stdout, bb);
    };

    const decoder = new TextDecoder(); // from utf-8 bytes
    const buf = new Uint8Array(8000);
    readLine = async function(): Promise<string | null> {
        const n = await Deno.stdin.read(buf) as (number | null);
        if (n === null)
            return null;        // End-Of-File
        return decoder.decode(buf.subarray(0, n));
    };

    const main = async function(): Promise<void> {
        if (Deno.args.length > 0) {
            await load(Deno.args[0]);
            if (Deno.args[1] !== '-')
                Deno.exit(0);
        }
        await readEvalPrintLoop();
    };

    main();
}
