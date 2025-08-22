# Advanced Matrix Calculator (Python + Next.js)

This project provides a symbolic matrix calculator with a Python FastAPI backend (SymPy) and a Next.js frontend. Cells accept numbers or symbols like `a`, `b`, `x`. Operations include +, -, *, transpose, inverse, determinant, trace, rank, and RREF. Expressions like `A * B + T(A)` are supported.

## Quick Start

### Backend (FastAPI + SymPy)

1. Open a terminal in `server/` and create a virtual environment (optional).
2. Install requirements:

```bash
pip install -r server/requirements.txt
```

3. Run the API (defaults to `http://localhost:8000`):

```bash
uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Next.js)

1. Open a terminal in `web/`.
2. Install dependencies:

```bash
npm install
```

3. Run the dev server (http://localhost:3000):

```bash
npm run dev
```

The frontend expects the backend at `http://localhost:8000`.

## API

POST `/evaluate`

Body:

```json
{
  "matrices": [{"name": "A", "rows": 2, "cols": 2, "data": [["a","0"],["0","a"]]}],
  "expression": "DET(A)"
}
```

Response:

- Scalar: `{ "kind": "scalar", "value": "a**2" }`
- Matrix: `{ "kind": "matrix", "value": [["a", "0"],["0","a"]] }`

## Notes

- SymPy ensures algebraic simplification (e.g., `(a)+(a)` -> `2*a`).
- Scalar-matrix multiplication is supported: `2*A` or `a*A`.
- Inverse requires square, non-singular matrices.


