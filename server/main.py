from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Literal, Union
from sympy import Matrix, symbols, simplify as sp_simplify
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


def to_list_of_str(m: Matrix) -> List[List[str]]:
    return [[str(sp_simplify(m[r, c])) for c in range(m.shape[1])] for r in range(m.shape[0])]


def tokenize(expr: str):
    tokens = []
    i = 0
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    ops = "+-*/()"
    digits = "0123456789"
    while i < len(expr):
        ch = expr[i]
        if ch.isspace():
            i += 1
            continue
        if ch in ops:
            tokens.append({"type": ch, "value": ch})
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
            tokens.append({"type": "NUMBER", "value": num})
            i = j
            continue
        if ch in letters:
            j = i
            while j < len(expr) and expr[j] in letters:
                j += 1
            word = expr[i:j].upper()
            tokens.append({"type": "WORD", "value": word})
            i = j
            continue
        raise ValueError(f"Unexpected character: {ch}")
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


def eval_rpn(rpn, matrices_map: dict) -> EvalResponse:
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
                stack.append(("scalar", str(sp_simplify(a.det()))))
            elif t["value"] == "TRACE":
                stack.append(("scalar", str(sp_simplify(a.trace()))))
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
                if tt == "+":
                    stack.append(("scalar", str(parse_expr(str(a), transformations=TRANSFORMS) + parse_expr(str(b), transformations=TRANSFORMS))))
                elif tt == "-":
                    stack.append(("scalar", str(parse_expr(str(a), transformations=TRANSFORMS) - parse_expr(str(b), transformations=TRANSFORMS))))
                elif tt == "*":
                    stack.append(("scalar", str(parse_expr(str(a), transformations=TRANSFORMS) * parse_expr(str(b), transformations=TRANSFORMS))))
                elif tt == "/":
                    stack.append(("scalar", str(parse_expr(str(a), transformations=TRANSFORMS) / parse_expr(str(b), transformations=TRANSFORMS))))
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
        return EvalResponse(kind="matrix", value=to_list_of_str(val))
    return EvalResponse(kind="scalar", value=str(sp_simplify(val)))


@app.post("/evaluate", response_model=EvalResponse)
def evaluate(req: EvalRequest):
    try:
        matrices_map = {}
        for m in req.matrices:
            sym_m = build_symbolic_matrix(m.data)
            matrices_map[m.name.upper()] = sym_m
        rpn = to_rpn(tokenize(req.expression))
        return eval_rpn(rpn, matrices_map)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/")
def root():
    return {"ok": True, "message": "Matrix Symbolic API running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


