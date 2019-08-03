# A Little Scheme in TypeScript

This is a small interpreter of a subset of Scheme
in circa 700 lines of _TypeScript 3.5/Node.js 12_.
It implements _almost_ the same language as

- [little-scheme-in-cs](https://github.com/nukata/little-scheme-in-cs)
- [little-scheme-in-dart](https://github.com/nukata/little-scheme-in-dart)
- [little-scheme-in-go](https://github.com/nukata/little-scheme-in-go)
- [little-scheme-in-java](https://github.com/nukata/little-scheme-in-java)
- [little-scheme-in-python](https://github.com/nukata/little-scheme-in-python)


and their meta-circular interpreter, 
[little-scheme](https://github.com/nukata/little-scheme).

As a Scheme implementation, 
it optimizes _tail calls_ and handles _first-class continuations_ properly.


## How to run

```
$ tsc -strict -t ES6 scm.ts
$ node scm.js
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

Press EOF (e.g. Control-D) to exit the session.

```
> Goodbye
$ 
```


You can run it with a Scheme script.
Examples are found in 
[little-scheme](https://github.com/nukata/little-scheme);
download it at `..` and you can try the following:


```
$ node scm.js ../little-scheme/examples/yin-yang-puzzle.scm

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
$ node scm.js ../little-scheme/examples/amb.scm
((1 A) (1 B) (1 C) (2 A) (2 B) (2 C) (3 A) (3 B) (3 C))
$ node scm.js ../little-scheme/examples/nqueens.scm
((5 3 1 6 4 2) (4 1 5 2 6 3) (3 6 2 5 1 4) (2 4 6 1 3 5))
$ node scm.js ../little-scheme/scm.scm < ../little-scheme/examples/nqueens.scm
((5 3 1 6 4 2) (4 1 5 2 6 3) (3 6 2 5 1 4) (2 4 6 1 3 5))
$ 
```

Press INTR (e.g. Control-C) to terminate the yin-yang-puzzle.

Put a "`-`" after the script in the command line to begin a session 
after running the script.

```
$ node scm.js ../little-scheme/examples/fib90.scm -
2880067194370816120
> (globals)
(apply call/cc globals error = < * - + symbol? eof-object? read newline display
list not null? pair? eqv? eq? cons cdr car fibonacci)
> (fibonacci 16)
987
> (fibonacci 1000)
4.346655768693743e+208
> 
```

Note the inexact result of `(fibonacci 10000)`, which was calculated with
`number`s of JavaScript.
I am considering using [`BigInt`](https://github.com/tc39/proposal-bigint)s.



## The implemented language

| Scheme Expression                   | Internal Representation             |
|:------------------------------------|:------------------------------------|
| numbers `1`, `2.3`                  | `number`                            |
| `#t`                                | `true`                              |
| `#f`                                | `false`                             |
| strings `"hello, world"`            | `string`                            |
| symbols `a`, `+`                    | `class Sym`                         |
| `()`                                | `null`                              |
| pairs `(1 . 2)`, `(x y z)`          | `class Cell`                        |
| closures `(lambda (x) (+ x 1))`     | `class Closure`                     |
| built-in procedures `car`, `cdr`    | `class Intrinsic`                   |
| continuations                       | `class Continuation`                |


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

|                      |                          |                     |
|:---------------------|:-------------------------|:--------------------|
| (`car` _lst_)        | (`not` _x_)              | (`eof-object?` _x_) |
| (`cdr` _lst_)        | (`list` _x_ ...)         | (`symbol?` _x_)     |
| (`cons` _x_ _y_)     | (`call/cc` _fun_)        | (`+` _x_ _y_)       |
| (`eq?` _x_ _y_)      | (`apply` _fun_ _arg_)    | (`-` _x_ _y_)       |
| (`eqv?` _x_ _y_)     | (`display` _x_)          | (`*` _x_ _y_)       |
| (`pair?` _x_)        | (`newline`)              | (`<` _x_ _y_)       |
| (`null?` _x_)        | (`read`)                 | (`=` _x_ _y_)       |
|                      | (`error` _reason_ _arg_) | (`globals`)         |

- `(error` _reason_ _arg_`)` throws an error with the message
  "`Error:` _reason_`:` _arg_".
  It is based on [SRFI-23](https://srfi.schemers.org/srfi-23/srfi-23.html).

- `(globals)` returns a list of keys of the global environment.
  It is not in the standard.

See [`GlobalEnv`](scm.ts#L330-L368)
in `scm.ts` for the implementation of the procedures
except `call/cc` and `apply`.  
`call/cc` and `apply` are implemented particularly at 
[`ApplyFunction`](scm.ts#L504-L538) in `scm.ts`.

I hope this serves as a handy model of how to write a Scheme interpreter
in TypeScript/JavaScript.
