# Acționarea electrică — robot portal (proiect UTM, variante 12/13/20)

A Node.js pipeline that takes a university project template (`Proiect_Varianta20_verificat.docx`, variant 20) plus a variant's numeric data and produces a complete, verified docx for that variant. The calculation chain (kinematics, dynamics, transmission, motor/converter selection, safety) is recomputed from the course handbook formulas (Îndrumar), and every formula, table and paragraph in the document is regenerated to match the variant's numbers.

Variants delivered so far:
- `Varianta mea.docx` — variant 13 (complete, verified).
- `Varianta 12.docx` — variant 12 (complete, verified).
- `Proiect_Varianta20_verificat.docx` — variant 20 template (read-only source).

## Repository layout

| File | Role |
|------|------|
| `compute.js` | Calculation engine. `getInputs(v)` + `compute(V)` produce all kinematic/dynamic/selection results. |
| `catalog.json` | Course catalog: motors (SM-*), reductors (RP-*), belts (AT10-*), converters (SC-*), screws (ȘB). |
| `templates.js` | 227 math-slot generators (`T(id, () => string)`). |
| `tables.js` | 13 table generators (T21, T33, T99, T188, T199, T279, T360, T453, T480, T513, T625, T727, T826). |
| `para_partA.js` / `para_partB.js` | 148 paragraph generators (cover, intro, §1–§6, conclusions). |
| `para_templates.js` | Aggregates `buildA` + `buildB`. |
| `slot_lib.js` | Char-level LCS alignment used to redistribute text into OMML `m:t` slots and table cells. |
| `extract.js` | Extracts ordered replaceable units (math / para / table) from a docx into JSON. |
| `apply.js` | Builds a variant docx from the v20 source by surgical text replacement. |
| `verify_regress.js` | Regression: generated units for a variant vs. an existing docx extraction. |
| `verify_final.js` | End-to-end verification of a written docx (math, paras, tables, core.xml, XML parse, zip parts). |
| `gen_dump.js` | Dumps all generated texts (math + paras + tables) for a variant. |

## Prerequisites

- Node.js ≥ 18
- `npm install` (installs `adm-zip`, `fast-xml-parser`, `pdf-parse`)

## Variant data

Inputs are defined in `compute.js` → `getInputs(v)`. Currently variants 12, 13 and 20 are supported. Variant 12 data (example):

```
mp=30, mg=8, SX=2.5, tX=3.5, mX=120, F0X=100,
SY=1, tY=1.8, mY=45, F0Y=50,
hZ=0.6, tZ=1.4, mZ=40, α=1, F0Z=70,
μ=0.01, tp=0.8, aadm=2, Δs=±0.5 mm, Lh=25000, Tamb=25,
U_retea=400, trans_X/Y='CD', trans_Z='SB'
```

To add a new variant, add a branch in `getInputs(v)` and (if needed) parameterize the generators — most are already driven by `V`/`inp`.

## Workflow

### 1. Generate a variant docx

```
node apply.js <variant>
```

Default variant is 13. Output: `Varianta <n>.docx` (or `Varianta mea.docx` for 13) in `C:/Users/DSV/Desktop/Lucrare/New folder/`.

Example:
```
node apply.js 12
```

### 2. Extract the written docx (for verification)

```
node extract.js "<path to docx>" units_<variant>.json
```

Example:
```
node extract.js "C:/Users/DSV/Desktop/Lucrare/New folder/Varianta 12.docx" units_12.json
```

### 3. Verify the written docx end-to-end

```
node verify_final.js <variant>
```

Checks: math slots (227), paragraphs (588), table cells (757), core.xml title, XML parse, zip parts. Expected: `ALL CHECKS PASSED`.

### 4. Regression check (generator vs. delivered docx)

```
node verify_regress.js <variant> <extract.json>
```

Examples:
```
node verify_regress.js 20 units.json       # v20 vs v20 doc (known: 1 pre-existing T279 R1C4 diff)
node verify_regress.js 13 units_out.json   # v13 vs delivered v13 docx (must be REGRESSION OK)
```

### 5. Dump all generated text (for review)

```
node gen_dump.js <variant> > dump.json
```

## How it works

1. `apply.js` reads the variant-20 source docx (untouched template) and the generated units for the target variant.
2. For each paragraph: rebuilds the paragraph XML, redistributing text across the original runs while preserving formatting (LCS alignment in `slot_lib.js`).
3. For each table: redistributes cell text within the existing cell structure.
4. For each math unit: redistributes the regenerated linearized OMML text into the original `m:t` slots.
5. Rewrites `docProps/core.xml` title (`(varianta 20)` → `(varianta N)`).
6. Writes the new docx.

The number of units (paragraphs, tables, rows, cells, math slots) is fixed by the v20 template — variants only change text, never structure. That is why `verify_final.js` compares counts and rejects mismatches.

## Key conventions

- Romanian decimal comma (`2,5`), thin space for ≥5 digits, NBSP before units.
- Superscripts as literal Unicode (`⁻⁴`, `²`, `⁶`); `×` = U+00D7.
- Wheel width follows belt width (`V.bw`); reductor adoption = largest ratio with `A.nr·i ≤ 2850`.
- Belt selection: keep AT10-32 if `fe_mid(X) ≥ 14,85 Hz`; otherwise narrowest belt with `fe_mid ≥ 15 Hz` and `Fadm ≥ 1,3·Fmax` on X; Y adopts the same belt.

## Notes

- The v20 source docx must stay untouched (it is the regression baseline).
- `gen_dump.js` invokes generators so function-valued paras/math survive `JSON.stringify`.
- `verify_regress.js` is the authoritative regression check (old `cmpdump.js` relied on dumps that never contained paras).
- Console output mangles Romanian diacritics; use the `read` tool / files for exact text.
- PowerShell lacks `grep`/`&&` — use `Select-String` and `;`.<|end|><|start|><|start|>assistant to=grep<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="path">
C:\Users\DSV\Documents\Default Project\README.md
