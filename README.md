# A Little Scheme in TypeScript

This is a small interpreter of a subset of Scheme
in about 800 lines of _TypeScript 4.6_ (_Deno 1.20_).
It implements almost the same language as

- [little-scheme-in-crystal](https://github.com/nukata/little-scheme-in-crystal)
- [little-scheme-in-cs](https://github.com/nukata/little-scheme-in-cs)
- [little-scheme-in-dart](https://github.com/nukata/little-scheme-in-dart)
- [little-scheme-in-go](https://github.com/nukata/little-scheme-in-go)
- [little-scheme-in-java](https://github.com/nukata/little-scheme-in-java)
- [little-scheme-in-kotlin](https://github.com/nukata/little-scheme-in-kotlin)
- [little-scheme-in-lisp](https://github.com/nukata/little-scheme-in-lisp)
- [little-scheme-in-php](https://github.com/nukata/little-scheme-in-php)
- [little-scheme-in-python](https://github.com/nukata/little-scheme-in-python)
- [little-scheme-in-ruby](https://github.com/nukata/little-scheme-in-ruby)

and their meta-circular interpreter, 
[little-scheme](https://github.com/nukata/little-scheme).
As a Scheme implementation, 
it optimizes _tail calls_ and handles _first-class continuations_ properly.

As from v2.0, it runs not on Node.js, but on Deno.

Before v2.0, two callbacks, `stdInOnData` and `stdInOnEnd`, were defined and used on Node.js as follows:

```TypeScript
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', stdInOnData);
    process.stdin.on('end', stdInOnEnd);
```

Now, `readLine` is defined on Deno as follows:

```TypeScript
    const decoder = new TextDecoder(); // from utf-8 bytes
    const buf = new Uint8Array(8000);
    readLine = async function(): Promise<string | null> {
        const n = await Deno.stdin.read(buf) as (number | null);
        if (n === null)
            return null;        // End-Of-File
        return decoder.decode(buf.subarray(0, n));
    };
```

You can run this interpreter also on _web browsers_ by giving appropriate values to
`readStringFrom`,  `write` and `readLine`.
Refer to [head](scm.ts#L20-L27) and [tail](scm.ts#L702-L717) of `scm.ts` for these functions.
The file [example/index.html](example/index.html) shows a simple example.
The following is an excerpt from it:

```JavaScript
  let readLine_resolve;

  readLine = () => new Promise((resolve, _reject) => {
      readLine_resolve = resolve;
  });

  ta.addEventListener("keyup", (event) => {
      if (event.key === "Enter") {
          let line = ta.value.substring(current_position);
          readLine_resolve(line);
      }
  });
```


## How to run

```
$ deno --version
deno 1.20.1 (release, aarch64-apple-darwin)
v8 10.0.139.6
typescript 4.6.2
$ deno bundle scm.ts scm.js
Check file:///Users/suzuki/tmp/little-scheme-in-typescript/scm.ts
Bundle file:///Users/suzuki/tmp/little-scheme-in-typescript/scm.ts
Emit "scm.js" (19.08KB)
$ deno run scm.js
> (+ 5 6)
11
> (cons 'a (cons 'b 'c))
(a b . c)
> (list
| 1
| 2
| 3
| )
(1 2 3)
> 
```

Or just use `example/scm.js`, which I provided by bundling `scm.ts` and `arith.ts`
in the same way as above.

```
$ deno run example/scm.js
> (+ 7.8 9)
16.8
> 
```

Press EOF (e.g. Control-D) to exit the session.

```
> Goodbye
$ 
```

You can also open `example/index.html` with a modern web browser to
run `scm.js`.

```
$ open example/index.html
```

It is also presented
[here](https://nukata.github.io/little-scheme-in-typescript/example/).


### How to run your Scheme script

You can run `node scm.js` with a Scheme script.
Examples are found in 
[little-scheme](https://github.com/nukata/little-scheme);
download it at `..` and you can try the following:


```
$ deno run --allow-read scm.js ../little-scheme/examples/yin-yang-puzzle.scm

*
**
***
****
*****
******
*******
********
*********
^C
$ deno run --allow-read scm.js ../little-scheme/examples/amb.scm
((1 A) (1 B) (1 C) (2 A) (2 B) (2 C) (3 A) (3 B) (3 C))
$ deno run --allow-read scm.js ../little-scheme/examples/nqueens.scm
((5 3 1 6 4 2) (4 1 5 2 6 3) (3 6 2 5 1 4) (2 4 6 1 3 5))
$ deno run --allow-read scm.js ../little-scheme/scm.scm < ../little-scheme/examples/nqueens.scm
((5 3 1 6 4 2) (4 1 5 2 6 3) (3 6 2 5 1 4) (2 4 6 1 3 5))
$ 
```

Press INTR (e.g. Control-C) to terminate the yin-yang-puzzle.

Put a "`-`" after the script in the command line to begin a session 
after running the script.

```
$ deno run --allow-read scm.js ../little-scheme/examples/fib90.scm -
2880067194370816120
> (globals)
(globals error number? = < * - + apply call/cc symbol? eof-object? read newline display list not
 null? pair? eq? cons cdr car fibonacci)
> (fibonacci 16)
987
> (fibonacci 1000)
434665576869374564356885276750406258025646605173717804024817290895365554179490518904038798400792
551692959225930803226347752096896232398733224711616429964409065331879382989696499285160037044761
37795166849228875
> 
```


## The implemented language

| Scheme Expression                   | Internal Representation             |
|:------------------------------------|:------------------------------------|
| numbers `1`, `2.3`                  | `bigint` or `number`                |
| `#t`                                | `true`                              |
| `#f`                                | `false`                             |
| strings `"hello, world"`            | `string`                            |
| symbols `a`, `+`                    | `class Sym`                         |
| `()`                                | `null`                              |
| pairs `(1 . 2)`, `(x y z)`          | `class Cell`                        |
| closures `(lambda (x) (+ x 1))`     | `class Closure`                     |
| built-in procedures `car`, `cdr`    | `class Intrinsic`                   |
| continuations                       | `class Continuation`                |

- Integers are represented by
  [`bigint`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt),
  which is supported by
  [TypeScipt 3.2](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-2.html)
  and later,  Node.js 10.4 and later, Firefox 68 and later etc.
  On the platforms that do not support `bigint` (e.g. Safari 13.0), integers
  are represented by `number` automatically.
  See [`tryToParse`](arith.ts#L78-L88) in `arith.ts`.

The implementation is similar to those of
[little-scheme-in-dart](https://github.com/nukata/little-scheme-in-dart) and
[little-scheme-in-cs](https://github.com/nukata/little-scheme-in-cs).


### Expression types

- _v_  [variable reference]

- (_e0_ _e1_...)  [procedure call]

- (`quote` _e_)  
  `'`_e_ [transformed into (`quote` _e_) when read]

- (`if` _e1_ _e2_ _e3_)  
  (`if` _e1_ _e2_)

- (`begin` _e_...)

- (`lambda` (_v_...) _e_...)

- (`set!` _v_ _e_)

- (`define` _v_ _e_)

For simplicity, this Scheme treats (`define` _v_ _e_) as an expression type.


### Built-in procedures

|                   |                          |                 |
|:------------------|:-------------------------|:----------------|
| (`car` _lst_)     | (`display` _x_)          | (`+` _n1_ _n2_) |
| (`cdr` _lst_)     | (`newline`)              | (`-` _n1_ _n2_) |
| (`cons` _x_ _y_)  | (`read`)                 | (`*` _n1_ _n2_) |
| (`eq?` _x_ _y_)   | (`eof-object?` _x_)      | (`<` _n1_ _n2_) |
| (`pair?` _x_)     | (`symbol?` _x_)          | (`=` _n1_ _n2_) |
| (`null?` _x_)     | (`call/cc` _fun_)        | (`number?` _x_) |
| (`not` _x_)       | (`apply` _fun_ _arg_)    | (`globals`)     |
| (`list` _x_ ...)  | (`error` _reason_ _arg_) |                 |

- `(error` _reason_ _arg_`)` throws an error with the message
  "`Error:` _reason_`:` _arg_".
  It is based on [SRFI-23](https://srfi.schemers.org/srfi-23/srfi-23.html).

- `(globals)` returns a list of keys of the global environment.
  It is not in the standard.

See [`GlobalEnv`](scm.ts#L330-L376)
in `scm.ts` for the implementation of the procedures
except `call/cc` and `apply`.  
`call/cc` and `apply` are implemented particularly at 
[`applyFunction`](scm.ts#L520-L555) in `scm.ts`.

I hope this serves as a handy model of how to write a Scheme interpreter
in TypeScript/JavaScript.
