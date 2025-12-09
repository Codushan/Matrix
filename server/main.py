from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Literal, Union
from sympy import Matrix, symbols, simplify as sp_simplify, latex
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
)

TRANSFORMS = standard_transformations + (implicit_multiplication_application,)


class MatrixPayload(BaseModel):
    name: str
    rows: int
    cols: int
    data: List[List[str]]


class EvalRequest(BaseModel):
    matrices: List[MatrixPayload]
    expression: str
    simplify_result: bool = False  # Add option to simplify


class EvalResponse(BaseModel):
    kind: Literal["matrix", "scalar"]
    value: Union[List[List[str]], str]


app = FastAPI(title="Matrix Symbolic API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_symbolic_matrix(data: List[List[str]]) -> Matrix:
    rows = len(data)
    cols = len(data[0]) if rows else 0
    flat = []
    for r in range(rows):
        for c in range(cols):
            text = str(data[r][c]).strip()
            if text == "":
                text = "0"
            # parse with implicit multiplication, so inputs like '2a' work
            flat.append(parse_expr(text, transformations=TRANSFORMS))
    return Matrix(rows, cols, flat)




def tokenize(expr: str):
    tokens = []
    i = 0
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    ops = "+-*/()"
    digits = "0123456789"
    
    # First pass: raw tokenization
    raw_tokens = []
    while i < len(expr):
        ch = expr[i]
        if ch.isspace():
            i += 1
            continue
        if ch in ops:
            raw_tokens.append({"type": ch, "value": ch})
            i += 1
            continue
        if ch in digits or (ch == '.' and i + 1 < len(expr) and expr[i + 1] in digits):
            j = i
            dot_count = 0
            while j < len(expr) and (expr[j] in digits or expr[j] == '.'):
                if expr[j] == '.':
                    dot_count += 1
                    if dot_count > 1:
                        raise ValueError("Invalid number format")
                j += 1
            num = expr[i:j]
            raw_tokens.append({"type": "NUMBER", "value": num})
            i = j
            continue
        if ch in letters:
            j = i
            while j < len(expr) and expr[j] in letters:
                j += 1
            word = expr[i:j].upper()
            raw_tokens.append({"type": "WORD", "value": word})
            i = j
            continue
        raise ValueError(f"Unexpected character: {ch}")

    # Second pass: insert implicit multiplication
    if not raw_tokens:
        return []
        
    tokens.append(raw_tokens[0])
    for k in range(1, len(raw_tokens)):
        prev = raw_tokens[k-1]
        curr = raw_tokens[k]
        
        # Rule: Insert * if:
        # 1. NUMBER followed by WORD or (
        # 2. ) followed by WORD or ( or NUMBER
        # 3. WORD (variable) followed by WORD or ( or NUMBER?
        #    Careful with functions like T(...). WORD followed by ( is function call IF WORD is function.
        #    If WORD is variable, it might be A(B)?
        
        insert_mult = False
        if prev["type"] == "NUMBER":
            if curr["type"] in ["WORD", "("]:
                insert_mult = True
        elif prev["type"] == ")":
            if curr["type"] in ["WORD", "(", "NUMBER"]:
                insert_mult = True
        elif prev["type"] == "WORD":
             # If prev is NOT a function (T, INV...), and followed by something, maybe?
             # But our RPN parser treats WORD as function only if in specific set.
             # Checking against "funcs" set here would be good but it's defined in to_rpn.
             # Let's be conservative. The user case is `(2/3)A` -> `)` followed by `WORD`.
             pass

        if insert_mult:
            tokens.append({"type": "*", "value": "*"})
        
        tokens.append(curr)
        
    return tokens


def to_rpn(tokens):
    out = []
    ops = []
    prec = {"+": 1, "-": 1, "*": 2, "/": 2}  # <-- add '/' here
    funcs = {"T", "INV", "DET", "TRACE", "RANK", "RREF"}
    for t in tokens:
        tt = t["type"]
        if tt == "WORD":
            if t["value"] in funcs:
                ops.append({"type": "FUNC", "value": t["value"]})
            else:
                out.append({"type": "VAR", "value": t["value"]})
        elif tt == "NUMBER":
            out.append({"type": "NUMBER", "value": t["value"]})
        elif tt == "(":
            ops.append(t)
        elif tt == ")":
            while ops and ops[-1]["type"] != "(":
                out.append(ops.pop())
            if not ops:
                raise ValueError("Mismatched parentheses")
            ops.pop()
            if ops and ops[-1]["type"] == "FUNC":
                out.append(ops.pop())
        elif tt in "+-*/":  # <-- add '/' here
            while ops and ops[-1]["type"] in "+-*/" and prec[tt] <= prec[ops[-1]["type"]]:
                out.append(ops.pop())
            ops.append(t)
        else:
            raise ValueError("Unknown token")
    while ops:
        if ops[-1]["type"] == "(":
            raise ValueError("Mismatched parentheses")
        out.append(ops.pop())
    return out


def format_matrix_result(m: Matrix, simplify: bool = False) -> List[List[str]]:
    # Only simplify if requested, otherwise use doit() which is faster for basic operations
    def process(val):
        if simplify:
            return latex(sp_simplify(val))
        return latex(val.doit())
        
    return [[process(m[r, c]) for c in range(m.shape[1])] for r in range(m.shape[0])]


def eval_rpn(rpn, matrices_map: dict, simplify: bool = False) -> EvalResponse:
    stack = []
    for t in rpn:
        tt = t["type"]
        if tt == "VAR":
            if t["value"] not in matrices_map:
                raise ValueError(f"Unknown matrix: {t['value']}")
            stack.append(("matrix", matrices_map[t["value"]]))
        elif tt == "NUMBER":
            stack.append(("scalar", t["value"]))
        elif tt == "FUNC":
            kind, a = stack.pop()
            if kind != "matrix":
                raise ValueError(f"{t['value']} expects a matrix")
            if t["value"] == "T":
                stack.append(("matrix", a.T))
            elif t["value"] == "INV":
                stack.append(("matrix", a.inv()))
            elif t["value"] == "DET":
                val = a.det()
                if simplify:
                    val = sp_simplify(val)
                stack.append(("scalar", str(val)))
            elif t["value"] == "TRACE":
                val = a.trace()
                if simplify:
                    val = sp_simplify(val)
                stack.append(("scalar", str(val)))
            elif t["value"] == "RANK":
                stack.append(("scalar", str(int(a.rank()))))
            elif t["value"] == "RREF":
                rref_m, _ = a.rref()
                stack.append(("matrix", rref_m))
            else:
                raise ValueError("Unsupported function")
        elif tt in "+-*/":
            b_kind, b = stack.pop()
            a_kind, a = stack.pop()
            # scalar * matrix or matrix * scalar
            if a_kind == "scalar" and b_kind == "matrix" and tt == "*":
                stack.append(("matrix", parse_expr(str(a), transformations=TRANSFORMS) * b))
                continue
            if a_kind == "matrix" and b_kind == "scalar" and tt == "*":
                stack.append(("matrix", a * parse_expr(str(b), transformations=TRANSFORMS)))
                continue
            # scalar / matrix or matrix / scalar
            if a_kind == "scalar" and b_kind == "matrix" and tt == "/":
                stack.append(("matrix", parse_expr(str(a), transformations=TRANSFORMS) / b))
                continue
            if a_kind == "matrix" and b_kind == "scalar" and tt == "/":
                stack.append(("matrix", a / parse_expr(str(b), transformations=TRANSFORMS)))
                continue
            # scalar-scalar
            if a_kind == "scalar" and b_kind == "scalar":
                # For scalars, we might want to keep them as strings until the end or parse them
                # But here we stick to strings -> sympy -> string
                val_a = parse_expr(str(a), transformations=TRANSFORMS)
                val_b = parse_expr(str(b), transformations=TRANSFORMS)
                if tt == "+":
                    res = val_a + val_b
                elif tt == "-":
                    res = val_a - val_b
                elif tt == "*":
                    res = val_a * val_b
                elif tt == "/":
                    res = val_a / val_b
                
                if simplify:
                    res = sp_simplify(res)
                stack.append(("scalar", str(res)))
                continue
            # matrix-matrix operations
            if a_kind != "matrix" or b_kind != "matrix":
                raise ValueError("Only matrix-matrix +,-,* are supported")
            if tt == "+":
                stack.append(("matrix", a + b))
            elif tt == "-":
                stack.append(("matrix", a - b))
            elif tt == "*":
                stack.append(("matrix", a * b))
            elif tt == "/":
                raise ValueError("Matrix division is not supported")
        else:
            raise ValueError("Invalid token type")
    if len(stack) != 1:
        raise ValueError("Invalid expression format. Use formats like: A + B, T(A), INV(A), DET(A)")
    kind, val = stack[0]
    if kind == "matrix":
        return EvalResponse(kind="matrix", value=format_matrix_result(val, simplify))
    
    # Final scalar result
    final_val = parse_expr(str(val), transformations=TRANSFORMS) # ensure it is sympy object
    if simplify:
        final_val = sp_simplify(final_val)
    else:
        final_val = final_val.doit()
        
    return EvalResponse(kind="scalar", value=latex(final_val))


@app.post("/evaluate", response_model=EvalResponse)
def evaluate(req: EvalRequest):
    try:
        matrices_map = {}
        for m in req.matrices:
            sym_m = build_symbolic_matrix(m.data)
            matrices_map[m.name.upper()] = sym_m
        rpn = to_rpn(tokenize(req.expression))
        return eval_rpn(rpn, matrices_map, req.simplify_result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/")
def root():
    return {"ok": True, "message": "Matrix Symbolic API running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


