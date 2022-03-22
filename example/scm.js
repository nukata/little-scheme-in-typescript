// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

function isNumeric(x) {
    const t = typeof x;
    return t === 'number' || t === 'bigint';
}
function add(x, y) {
    if (typeof x === 'number') {
        if (typeof y === 'number') return x + y;
        else return x + Number(y);
    } else {
        if (typeof y === 'number') return Number(x) + y;
        else return x + y;
    }
}
function subtract(x, y) {
    if (typeof x === 'number') {
        if (typeof y === 'number') return x - y;
        else return x - Number(y);
    } else {
        if (typeof y === 'number') return Number(x) - y;
        else return x - y;
    }
}
function multiply(x, y) {
    if (typeof x === 'number') {
        if (typeof y === 'number') return x * y;
        else return x * Number(y);
    } else {
        if (typeof y === 'number') return Number(x) * y;
        else return x * y;
    }
}
function compare(x, y) {
    if (typeof x === 'number') {
        if (typeof y === 'number') return Math.sign(x - y);
        else return Math.sign(x - Number(y));
    } else {
        if (typeof y === 'number') return Math.sign(Number(x) - y);
        else return x < y ? -1 : y < x ? 1 : 0;
    }
}
function tryToParse(token) {
    try {
        return BigInt(token);
    } catch (_ex) {
        const n = Number(token);
        if (isNaN(n)) return null;
        return n;
    }
}
function convertToString(x) {
    const s = x + '';
    if (typeof BigInt !== 'undefined') {
        if (typeof x === 'number') {
            if (Number.isInteger(x) && !s.includes('e')) return s + '.0';
        }
    }
    return s;
}
'use strict';
let runOnNextLoop = (callback)=>{
    setTimeout(callback, 0);
};
let readStringFrom;
let write;
let readLine;
class Cell {
    car;
    cdr;
    constructor(car, cdr){
        this.car = car;
        this.cdr = cdr;
    }
    *[Symbol.iterator]() {
        let j = this;
        while(j instanceof Cell){
            yield j.car;
            j = j.cdr;
        }
        if (j !== null) throw new ImproperListException(j);
    }
    get length() {
        let i = 0;
        for (const _e of this)i++;
        return i;
    }
}
class ImproperListException extends Error {
    tail;
    constructor(tail){
        super();
        this.tail = tail;
    }
}
function fst(x) {
    return x.car;
}
function snd(x) {
    return x.cdr.car;
}
class Sym {
    name;
    constructor(name){
        this.name = name;
    }
    toString() {
        return this.name;
    }
    static symbols = {};
    static interned(name) {
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
class Environment {
    sym;
    val;
    next;
    constructor(sym, val, next){
        this.sym = sym;
        this.val = val;
        this.next = next;
    }
    *[Symbol.iterator]() {
        let env = this;
        while(env !== null){
            yield env;
            env = env.next;
        }
    }
    lookFor(sym) {
        for (const env of this)if (env.sym === sym) return env;
        throw ReferenceError(sym.toString());
    }
    prependDefs(symbols, data) {
        if (symbols === null) {
            if (data !== null) throw Error('surplus arg: ' + stringify(data));
            return this;
        } else {
            if (data === null) throw Error('surplus param: ' + stringify(symbols));
            return new Environment(symbols.car, data.car, this.prependDefs(symbols.cdr, data.cdr));
        }
    }
}
var ContOp;
(function(ContOp1) {
    ContOp1[ContOp1["Then"] = 0] = "Then";
    ContOp1[ContOp1["Begin"] = 1] = "Begin";
    ContOp1[ContOp1["Define"] = 2] = "Define";
    ContOp1[ContOp1["SetQ"] = 3] = "SetQ";
    ContOp1[ContOp1["Apply"] = 4] = "Apply";
    ContOp1[ContOp1["ApplyFun"] = 5] = "ApplyFun";
    ContOp1[ContOp1["EvalArg"] = 6] = "EvalArg";
    ContOp1[ContOp1["ConsArgs"] = 7] = "ConsArgs";
    ContOp1[ContOp1["RestoreEnv"] = 8] = "RestoreEnv";
})(ContOp || (ContOp = {}));
class Continuation {
    stack;
    constructor(other){
        this.stack = other === undefined ? [] : other.stack.slice();
    }
    copyFrom(other) {
        this.stack = other.stack.slice();
    }
    get length() {
        return this.stack.length;
    }
    toString() {
        const ss = [];
        for (const [op, val] of this.stack)ss.push(ContOp[op] + ' ' + stringify(val));
        return '$<' + ss.join('\n\t  ') + '>';
    }
    push(operation, value) {
        this.stack.push([
            operation,
            value
        ]);
    }
    pop() {
        const result = this.stack.pop();
        if (result === undefined) throw new Error('the continuation is empty.');
        return result;
    }
    pushRestoreEnv(env) {
        const len = this.stack.length;
        if (len > 0) {
            if (this.stack[len - 1][0] === ContOp.RestoreEnv) return;
        }
        this.push(ContOp.RestoreEnv, env);
    }
}
class Closure {
    params;
    body;
    env;
    constructor(params, body, env){
        this.params = params;
        this.body = body;
        this.env = env;
    }
}
class Intrinsic {
    name;
    arity;
    fun;
    constructor(name, arity, fun){
        this.name = name;
        this.arity = arity;
        this.fun = fun;
    }
    toString() {
        return '$<' + this.name + ':' + this.arity + '>';
    }
}
class ErrorException extends Error {
    constructor(reason, arg){
        super(stringify(reason, false) + ': ' + stringify(arg));
    }
}
class EOFException extends Error {
    constructor(){
        super('unexpected EOF');
    }
}
const None = {
    toString: ()=>'#<VOID>'
};
const EOF = {
    toString: ()=>'#<EOF>'
};
const CallCCVal = {
    toString: ()=>'#<call/cc>'
};
const ApplyVal = {
    toString: ()=>'#<apply>'
};
function stringify(exp, quote = true) {
    if (exp === null) {
        return '()';
    } else if (exp === true) {
        return '#t';
    } else if (exp === false) {
        return '#f';
    } else if (exp instanceof Cell) {
        const ss = [];
        try {
            for (const e of exp)ss.push(stringify(e, quote));
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
        const ss = [];
        for (const e of exp)if (e === GlobalEnv) {
            ss.push('GlobalEnv');
            break;
        } else if (e.sym === null) {
            ss.push('|');
        } else {
            ss.push(e.sym.toString());
        }
        return '#<' + ss.join(' ') + '>';
    } else if (exp instanceof Closure) {
        return '#<' + stringify(exp.params) + ':' + stringify(exp.body) + ':' + stringify(exp.env) + '>';
    } else if (typeof exp === 'string' && quote) {
        return '"' + exp + '"';
    } else if (isNumeric(exp)) {
        return convertToString(exp);
    } else {
        return '' + exp;
    }
}
function c(name, arity, fun, next) {
    return new Environment(Sym.interned(name), new Intrinsic(name, arity, fun), next);
}
function globals(_x) {
    let j = null;
    const env = GlobalEnv.next;
    if (env !== null) for (const e of env)j = new Cell(e.sym, j);
    return j;
}
const G1 = c('+', 2, (x)=>add(fst(x), snd(x))
, c('-', 2, (x)=>subtract(fst(x), snd(x))
, c('*', 2, (x)=>multiply(fst(x), snd(x))
, c('<', 2, (x)=>compare(fst(x), snd(x)) < 0
, c('=', 2, (x)=>compare(fst(x), snd(x)) === 0
, c('number?', 1, (x)=>isNumeric(fst(x))
, c('error', 2, (x)=>{
    throw new ErrorException(fst(x), snd(x));
}, c('globals', 0, globals, null))))))));
const GlobalEnv = new Environment(null, null, c('car', 1, (x)=>fst(x).car
, c('cdr', 1, (x)=>fst(x).cdr
, c('cons', 2, (x)=>new Cell(fst(x), snd(x))
, c('eq?', 2, (x)=>Object.is(fst(x), snd(x))
, c('pair?', 1, (x)=>fst(x) instanceof Cell
, c('null?', 1, (x)=>fst(x) === null
, c('not', 1, (x)=>fst(x) === false
, c('list', -1, (x)=>x
, c('display', 1, (x)=>{
    write(stringify(fst(x), false));
    return new Promise((resolve)=>{
        runOnNextLoop(()=>resolve(None)
        );
    });
}, c('newline', 0, (_x)=>{
    write('\n');
    return new Promise((resolve)=>{
        runOnNextLoop(()=>resolve(None)
        );
    });
}, c('read', 0, (_x)=>readExpression('', '')
, c('eof-object?', 1, (x)=>fst(x) === EOF
, c('symbol?', 1, (x)=>fst(x) instanceof Sym
, new Environment(CallCCSym, CallCCVal, new Environment(ApplySym, ApplyVal, G1))))))))))))))));
async function evaluate(exp, env) {
    const k = new Continuation();
    try {
        for(;;){
            for(;;){
                if (exp instanceof Cell) {
                    const kar = exp.car;
                    const kdr = exp.cdr;
                    if (kar === QuoteSym) {
                        exp = kdr.car;
                        break;
                    } else if (kar === IfSym) {
                        exp = kdr.car;
                        k.push(ContOp.Then, kdr.cdr);
                    } else if (kar === BeginSym) {
                        exp = kdr.car;
                        if (kdr.cdr !== null) k.push(ContOp.Begin, kdr.cdr);
                    } else if (kar === LambdaSym) {
                        exp = new Closure(kdr.car, kdr.cdr, env);
                        break;
                    } else if (kar === DefineSym) {
                        exp = snd(kdr);
                        k.push(ContOp.Define, kdr.car);
                    } else if (kar === SetQSym) {
                        exp = snd(kdr);
                        const v = kdr.car;
                        k.push(ContOp.SetQ, env.lookFor(v));
                    } else {
                        exp = kar;
                        k.push(ContOp.Apply, kdr);
                    }
                } else if (exp instanceof Sym) {
                    exp = env.lookFor(exp).val;
                    break;
                } else {
                    break;
                }
            }
            Loop2: for(;;){
                if (k.length === 0) return exp;
                const [op, x] = k.pop();
                switch(op){
                    case ContOp.Then:
                        {
                            const j = x;
                            if (exp === false) {
                                if (j.cdr === null) {
                                    exp = None;
                                    break;
                                } else {
                                    exp = snd(j);
                                    break Loop2;
                                }
                            } else {
                                exp = j.car;
                                break Loop2;
                            }
                        }
                    case ContOp.Begin:
                        {
                            const j = x;
                            if (j.cdr !== null) k.push(ContOp.Begin, j.cdr);
                            exp = j.car;
                            break Loop2;
                        }
                    case ContOp.Define:
                        env.next = new Environment(x, exp, env.next);
                        exp = None;
                        break;
                    case ContOp.SetQ:
                        x.val = exp;
                        exp = None;
                        break;
                    case ContOp.Apply:
                        if (x === null) {
                            [exp, env] = applyFunction(exp, null, k, env);
                            if (exp instanceof Promise) exp = await exp;
                            break;
                        } else {
                            k.push(ContOp.ApplyFun, exp);
                            let j = x;
                            while(j.cdr !== null){
                                k.push(ContOp.EvalArg, j.car);
                                j = j.cdr;
                            }
                            exp = j.car;
                            k.push(ContOp.ConsArgs, null);
                            break Loop2;
                        }
                    case ContOp.ConsArgs:
                        {
                            const args = new Cell(exp, x);
                            const [op2, exp2] = k.pop();
                            switch(op2){
                                case ContOp.EvalArg:
                                    exp = exp2;
                                    k.push(ContOp.ConsArgs, args);
                                    break Loop2;
                                case ContOp.ApplyFun:
                                    [exp, env] = applyFunction(exp2, args, k, env);
                                    if (exp instanceof Promise) exp = await exp;
                                    break;
                                default:
                                    throw Error('invalid operation: ' + op2);
                            }
                            break;
                        }
                    case ContOp.RestoreEnv:
                        env = x;
                        break;
                    default:
                        throw Error('invalid operation: ' + op);
                }
            }
        }
    } catch (ex) {
        if (ex instanceof ErrorException) throw ex;
        else if (k.length === 0) throw ex;
        const ex2 = new Error(ex + '\n\t' + stringify(k));
        if (typeof ex === 'object' && ex !== null) {
            const stack = ex.stack;
            if (stack !== undefined) ex2.stack = ex2.message + stack;
        }
        throw ex2;
    }
}
function applyFunction(fun, arg, k, env) {
    for(;;)if (fun === CallCCVal) {
        k.pushRestoreEnv(env);
        fun = fst(arg);
        arg = new Cell(new Continuation(k), null);
    } else if (fun === ApplyVal) {
        fun = fst(arg);
        arg = snd(arg);
    } else {
        break;
    }
    if (fun instanceof Intrinsic) {
        if (fun.arity >= 0) {
            if (arg === null ? fun.arity > 0 : arg.length !== fun.arity) throw Error('arity not matched: ' + fun + ' and ' + stringify(arg));
        }
        const result = fun.fun(arg);
        return [
            result,
            env
        ];
    } else if (fun instanceof Closure) {
        k.pushRestoreEnv(env);
        k.push(ContOp.Begin, fun.body);
        return [
            None,
            new Environment(null, null, fun.env.prependDefs(fun.params, arg))
        ];
    } else if (fun instanceof Continuation) {
        k.copyFrom(fun);
        return [
            fst(arg),
            env
        ];
    } else {
        throw Error('not a function: ' + stringify(fun) + ' with ' + stringify(arg));
    }
}
function splitStringIntoTokens(source) {
    const result = [];
    for (const line of source.split('\n')){
        const x = [];
        const ss = [];
        let i = 0;
        for (const e of line.split('"')){
            if (i % 2 === 0) {
                x.push(e);
            } else {
                ss.push('"' + e);
                x.push('#s');
            }
            i++;
        }
        let s = x.join(' ').split(';')[0];
        s = s.replace(/'/g, " ' ").replace(/\)/g, ' ) ').replace(/\(/g, ' ( ');
        for (const e1 of s.split(/\s+/))if (e1 === '#s') {
            const s = ss.shift();
            result.push(s);
        } else if (e1 !== '') {
            result.push(e1);
        }
    }
    return result;
}
function readFromTokens(tokens) {
    const token = tokens.shift();
    switch(token){
        case undefined:
            throw new EOFException();
        case '(':
            {
                const z = new Cell(null, null);
                let y = z;
                while(tokens[0] !== ')'){
                    if (tokens[0] === '.') {
                        tokens.shift();
                        y.cdr = readFromTokens(tokens);
                        if (tokens[0] !== ')') throw SyntaxError(') is expected');
                        break;
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
        case "'":
            {
                const e = readFromTokens(tokens);
                return new Cell(QuoteSym, new Cell(e, null));
            }
        case '#f':
            return false;
        case '#t':
            return true;
        case '+':
        case '-':
            return Sym.interned(token);
    }
    if (token[0] === '"') {
        return token.substring(1);
    } else {
        const n = tryToParse(token);
        if (n === null) return Sym.interned(token);
        return n;
    }
}
async function load(fileName) {
    const source = readStringFrom(fileName);
    const tokens = splitStringIntoTokens(source);
    let result = None;
    while(tokens.length > 0){
        const exp = readFromTokens(tokens);
        result = await evaluate(exp, GlobalEnv);
    }
    return result;
}
let stdInTokens = [];
async function readExpression(prompt1, prompt2) {
    for(;;){
        const old = stdInTokens.slice();
        try {
            return readFromTokens(stdInTokens);
        } catch (ex) {
            if (ex instanceof EOFException) {
                write(old.length === 0 ? prompt1 : prompt2);
                const line = await readLine();
                if (line === null) return EOF;
                const tokens = splitStringIntoTokens(line);
                stdInTokens = old.concat(tokens);
            } else {
                stdInTokens = [];
                throw ex;
            }
        }
    }
}
async function readEvalPrintLoop() {
    for(;;)try {
        const exp = await readExpression('> ', '| ');
        if (exp === EOF) {
            write("Goodbye\n");
            return;
        }
        const result = await evaluate(exp, GlobalEnv);
        if (result !== None) write(stringify(result) + '\n');
    } catch (ex) {
        write(ex + '\n');
    }
}
if (typeof Deno !== 'undefined') {
    runOnNextLoop = queueMicrotask;
    readStringFrom = Deno.readTextFileSync;
    const encoder = new TextEncoder();
    write = (s)=>{
        const bb = encoder.encode(s);
        Deno.writeAllSync(Deno.stdout, bb);
    };
    const decoder = new TextDecoder();
    const buf = new Uint8Array(8000);
    readLine = async function() {
        const n = await Deno.stdin.read(buf);
        if (n === null) return null;
        return decoder.decode(buf.subarray(0, n));
    };
    const main = async function() {
        if (Deno.args.length > 0) {
            await load(Deno.args[0]);
            if (Deno.args[1] !== '-') Deno.exit(0);
        }
        await readEvalPrintLoop();
    };
    main();
}
