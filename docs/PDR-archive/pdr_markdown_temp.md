# PDR: Dimension Formula Compiler and Responsive Bytecode Schema for PixelBrain

## Summary

**Change class:** Architectural  
**Goal:** Define a formal system that allows AI-generated PDRs to compile dimension specifications into unambiguous mathematical bytecode formulas for PixelBrain.

This PDR introduces a canonical pipeline:

```txt
Human Dimension Spec
→ Canonical Layout Schema
→ Mathematical Formula AST
→ Bytecode Formula IR
→ PixelBrain Runtime Execution
```

The intent is to let PixelBrain reliably take layout and asset sizing instructions such as:

- Desktop Width: `1920px` full-screen or `1200px–1440px` container
- Mobile Width: `360px` to `375px/390px`
- Tablet Width: `768px`
- Hero Banner: `1920×1080` or `1920×600`
- Product Thumbnail: `150×150` to `300×300`
- Logo: `250×100` or `100×100`
- Favicon: `16×16` to `32×32`

and convert them into exact, executable formulas without ambiguity.

---

## Why

PixelBrain cannot depend on prose interpretation at runtime.

A human can read:

- “Hero banner 1920×1080”
- “Desktop container 1200 to 1440”
- “Mobile width 360 to 390”

and infer intent. A rendering engine cannot. It needs exact rules for:

- width computation
- height computation
- aspect-ratio locking
- min/max clamp behavior
- viewport or parent binding
- fit mode
- anchor mode
- snapping
- overflow behavior
- variant selection

Without a formalized dimension compiler, AI-generated scene and layout instructions remain ambiguous, which breaks the goal of feeding PixelBrain a PDR and having it draw the scene correctly.

---

## Scope

### In scope

- Dimension parsing
- Canonical dimension schema
- Mathematical formula AST
- Bytecode formula generation
- Viewport-class compilation
- Variant handling
- Runtime execution contract
- Validation rules
- Error conditions
- Examples for standard web-style asset sizes

### Out of scope

- Final rendering style
- Full environment composition
- Particle systems
- Lighting synthesis
- Scene storytelling logic
- Asset generation itself

This PDR covers the **dimension/formula substrate**, not the full scene art stack.

---

## Success Criteria

The system is successful when:

1. A human-readable dimension spec can be parsed into a canonical schema.
2. Every canonical schema can be compiled into a mathematical formula tree.
3. Every formula tree can be compiled into bytecode instructions.
4. PixelBrain can execute those instructions to produce exact width/height outputs.
5. Alternative specs like “A or B” compile into explicit variants.
6. Invalid or ambiguous dimension specs fail loudly.
7. Responsive behavior is represented as formula logic, not special-case heuristics.

---

## Core Architectural Decision

Introduce a **Dimension Formula Compiler** as a first-class subsystem in PixelBrain.

This subsystem will:

1. parse raw dimension declarations
2. normalize them into canonical dimension records
3. convert them into mathematical AST nodes
4. compile them into bytecode programs
5. expose those programs to the PixelBrain runtime

This becomes the formal bridge between PDR language and executable layout math.

---

# 1. Canonical Dimension Types

Every dimension spec must resolve to one of the following canonical forms.

## 1.1 Fixed

Exact size.

Examples:

- `1920×1080`
- `100×100`
- `768px`

```txt
width = 1920
height = 1080
```

---

## 1.2 Range

A bounded interval.

Examples:

- `1200px–1440px`
- `16×16 to 32×32`

```txt
width ∈ [1200, 1440]
height ∈ [16, 32]
```

---

## 1.3 Aspect-Locked

One dimension derived from the other via aspect ratio.

Example:

- `1920×1080` → ratio = 16:9

```txt
height = width * (9 / 16)
```

---

## 1.4 Viewport-Bound

Depends on viewport dimensions.

Examples:

- full-screen desktop width
- mobile width rules

```txt
width = viewport.width
```

or

```txt
width = clamp(viewport.width, 375, 390)
```

---

## 1.5 Container-Bound

Depends on parent/container dimensions.

Example:

- desktop content width: `1200px–1440px`

```txt
width = clamp(parent.width, 1200, 1440)
```

---

## 1.6 Variant

A spec with multiple allowed exact or formula-based alternatives.

Examples:

- hero banner: `1920×1080` or `1920×600`
- logo: `250×100` or `100×100`

Variants compile into separate canonical records and separate bytecode programs.

---

# 2. Formal Dimension Contract

Every dimension record must normalize into the following minimum structure.

```ts
type DimensionFormulaSpec = {
  id: string;
  kind: 'fixed' | 'range' | 'aspect' | 'viewport' | 'container' | 'variant';
  widthPolicy: FormulaNode;
  heightPolicy?: FormulaNode;
  aspectRatio?: { numerator: number; denominator: number };
  clamp?: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  };
  fitMode?: 'fill' | 'contain' | 'cover' | 'stretch' | 'snap';
  anchor?: 'top-left' | 'top-center' | 'center' | 'bottom-center';
  snapMode?: 'none' | 'integer' | 'pixel';
  overflowPolicy?: 'clip' | 'scale-down' | 'allow';
  variants?: DimensionFormulaSpec[];
};
```

This schema eliminates soft interpretation at compile time.

---

# 3. Compiler Pipeline

## Phase 1: Parse Human Dimension Spec

Input examples:

- `1920×1080`
- `1200px–1440px`
- `360px`
- `16×16 to 32×32`
- `250×100 or 100×100`

Parser responsibilities:

- normalize separators
- normalize units
- detect fixed vs range vs variant
- preserve semantic labels
- reject malformed strings

### Example parse result

```json
{
  "raw": "1920×1080",
  "parsed": {
    "type": "fixed",
    "width": 1920,
    "height": 1080,
    "unit": "px"
  }
}
```

---

## Phase 2: Canonicalize

Convert parsed specs into canonical layout meaning.

### Example input

`Desktop Width: 1920px (full-screen) or 1200px–1440px (container)`

### Canonical form

```json
{
  "desktop": {
    "fullscreen": {
      "kind": "viewport",
      "widthPolicy": "viewport.width"
    },
    "container": {
      "kind": "container",
      "widthPolicy": "clamp(parent.width, 1200, 1440)"
    }
  }
}
```

---

## Phase 3: Build Formula AST

Convert canonical policies into formula nodes.

### Examples

```txt
W = viewport.width
W = clamp(parent.width, 1200, 1440)
H = W * 9 / 16
S = selectNearest(target.size, [16, 32])
```

---

## Phase 4: Compile Formula AST to Bytecode

Each formula becomes a program using a small instruction set.

---

# 4. Formula AST

```ts
type FormulaNode =
  | { type: 'const'; value: number }
  | { type: 'viewportWidth' }
  | { type: 'viewportHeight' }
  | { type: 'parentWidth' }
  | { type: 'parentHeight' }
  | { type: 'add'; a: FormulaNode; b: FormulaNode }
  | { type: 'sub'; a: FormulaNode; b: FormulaNode }
  | { type: 'mul'; a: FormulaNode; b: FormulaNode }
  | { type: 'div'; a: FormulaNode; b: FormulaNode }
  | { type: 'min'; a: FormulaNode; b: FormulaNode }
  | { type: 'max'; a: FormulaNode; b: FormulaNode }
  | { type: 'clamp'; value: FormulaNode; min: FormulaNode; max: FormulaNode }
  | { type: 'sameAsWidth' }
  | { type: 'sameAsHeight' }
  | { type: 'selectNearest'; value: FormulaNode; options: number[] };
```

---

# 5. Bytecode Instruction Set

## Registers

Suggested register roles:

- `r0` → viewport width
- `r1` → viewport height
- `r2` → parent width
- `r3` → parent height
- `r4` → computed width
- `r5` → computed height
- `r6` → temp
- `r7` → temp
- `r8` → temp

## Core instructions

```txt
LOAD_CONST <reg> <value>
LOAD_VIEWPORT_WIDTH <reg>
LOAD_VIEWPORT_HEIGHT <reg>
LOAD_PARENT_WIDTH <reg>
LOAD_PARENT_HEIGHT <reg>
MOVE <dst> <src>
ADD <dst> <a> <b>
SUB <dst> <a> <b>
MUL <dst> <a> <b>
DIV <dst> <a> <b>
MIN <dst> <a> <b>
MAX <dst> <a> <b>
CLAMP <dst> <value> <min> <max>
ROUND <dst> <src>
FLOOR <dst> <src>
CEIL <dst> <src>
SELECT_NEAREST <dst> <value> [list]
SET_WIDTH <reg>
SET_HEIGHT <reg>
SET_ASPECT <num> <den>
SET_FIT_MODE <mode>
SET_ANCHOR <anchor>
SET_SNAP <mode>
END
```

---

# 6. Canonical Examples from Provided Specs

## 6.1 Desktop Width

### Full-screen
```txt
width = viewport.width
```

### Container
```txt
width = clamp(parent.width, 1200, 1440)
```

---

## 6.2 Mobile Width

### Android
```txt
width = 360
```

### iOS family
```txt
width = clamp(viewport.width, 375, 390)
```

---

## 6.3 Tablet Width

```txt
width = 768
```

---

## 6.4 Hero Banner

### Standard hero
```txt
width = 1920
height = 1080
aspect = 16:9
```

### Short hero strip
```txt
width = 1920
height = 600
```

---

## 6.5 Product Thumbnail

```txt
size = clamp(parent.width, 150, 300)
width = size
height = size
```

---

## 6.6 Logo

### Rectangle
```txt
width = 250
height = 100
```

### Square
```txt
width = 100
height = 100
```

---

## 6.7 Favicon

Recommended exact export sizes instead of fluid interpolation:

```txt
size = selectNearest(target.size, [16, 32])
width = size
height = size
```

---

# 7. Bytecode Examples

## 7.1 Desktop fullscreen width

```txt
LOAD_VIEWPORT_WIDTH r4
SET_WIDTH r4
SET_SNAP integer
END
```

---

## 7.2 Desktop container width

```txt
LOAD_PARENT_WIDTH r2
LOAD_CONST r6 1200
LOAD_CONST r7 1440
CLAMP r4 r2 r6 r7
SET_WIDTH r4
SET_SNAP integer
END
```

---

## 7.3 Tablet width

```txt
LOAD_CONST r4 768
SET_WIDTH r4
SET_SNAP integer
END
```

---

## 7.4 Mobile iOS width

```txt
LOAD_VIEWPORT_WIDTH r0
LOAD_CONST r6 375
LOAD_CONST r7 390
CLAMP r4 r0 r6 r7
SET_WIDTH r4
SET_SNAP integer
END
```

---

## 7.5 Hero banner 1920×1080

```txt
LOAD_CONST r4 1920
LOAD_CONST r5 1080
SET_WIDTH r4
SET_HEIGHT r5
SET_ASPECT 16 9
SET_FIT_MODE cover
SET_ANCHOR center
SET_SNAP integer
END
```

---

## 7.6 Hero banner 1920×600

```txt
LOAD_CONST r4 1920
LOAD_CONST r5 600
SET_WIDTH r4
SET_HEIGHT r5
SET_FIT_MODE cover
SET_ANCHOR center
SET_SNAP integer
END
```

---

## 7.7 Product thumbnail square

```txt
LOAD_PARENT_WIDTH r2
LOAD_CONST r6 150
LOAD_CONST r7 300
CLAMP r6 r2 r6 r7
MOVE r4 r6
MOVE r5 r6
SET_WIDTH r4
SET_HEIGHT r5
SET_FIT_MODE contain
SET_ANCHOR center
SET_SNAP integer
END
```

---

## 7.8 Logo rectangle

```txt
LOAD_CONST r4 250
LOAD_CONST r5 100
SET_WIDTH r4
SET_HEIGHT r5
SET_SNAP pixel
END
```

---

## 7.9 Logo square

```txt
LOAD_CONST r4 100
LOAD_CONST r5 100
SET_WIDTH r4
SET_HEIGHT r5
SET_SNAP pixel
END
```

---

## 7.10 Favicon

```txt
LOAD_PARENT_WIDTH r2
SELECT_NEAREST r6 r2 [16,32]
MOVE r4 r6
MOVE r5 r6
SET_WIDTH r4
SET_HEIGHT r5
SET_SNAP pixel
END
```

---

# 8. Authoring Rules for AI Systems

## Rule 1
Every dimension declaration must resolve to one canonical type:

- fixed
- range
- aspect
- viewport
- container
- variant

No unresolved prose past canonicalization.

## Rule 2
Any use of `or` must become explicit variants.

Example:

- `hero.standard = 1920×1080`
- `hero.strip = 1920×600`

## Rule 3
Width-only specs do not imply height unless:

- height is provided
- height is inherited
- height is formula-derived
- height is explicitly deferred

## Rule 4
Ranges must compile into formulas, never descriptive language.

Good:

```txt
width = clamp(parent.width, 1200, 1440)
```

Bad:

```txt
fairly wide container
```

## Rule 5
Aspect descriptions must become numeric ratios.

Good:

```txt
aspect = 16:9
height = width * 9 / 16
```

Bad:

```txt
widescreen
```

## Rule 6
Every compiled dimension must include snap mode.

Recommended defaults:

- icons, logos, favicons → `pixel`
- banners, containers, hero assets → `integer`
- cinematic background planes → `none` or `integer`

---

# 9. Recommended PDR Authoring Block

Every PixelBrain PDR should include a machine-readable section like this:

```md
## Dimension Formula Contract

### Viewport Classes
- desktop.fullscreen.width = viewport.width
- desktop.container.width = clamp(parent.width, 1200, 1440)
- tablet.width = 768
- mobile.android.width = 360
- mobile.ios.width = clamp(viewport.width, 375, 390)

### Asset Classes
- hero.standard = 1920×1080, aspect 16:9, snap integer
- hero.strip = 1920×600, fixed, snap integer
- thumbnail.square = clamp(parent.width, 150, 300), square, snap integer
- logo.rect = 250×100, fixed, snap pixel
- logo.square = 100×100, fixed, snap pixel
- favicon.small = 16×16, fixed, snap pixel
- favicon.large = 32×32, fixed, snap pixel
```

This becomes the input contract for the compiler.

---

# 10. Runtime Execution Contract

The PixelBrain runtime must support the following behavior:

1. load the compiled bytecode program
2. provide runtime bindings:
   - viewport width
   - viewport height
   - parent width
   - parent height
3. execute math instructions deterministically
4. output width and height
5. apply fit mode
6. apply anchor rule
7. apply snap mode
8. expose computed dimensions to the draw pipeline

The runtime must not reinterpret human prose. It only executes compiled bytecode or canonicalized data.

---

# 11. Error Handling

The compiler must fail loudly for:

- malformed dimensions
- mixed units without conversion policy
- incomplete variants
- width-only declarations with no allowed height rule
- impossible clamps
- negative values unless explicitly allowed
- unsupported semantic phrases

### Example failures

- `hero = kinda wide`
- `mobile = normal phone size`
- `logo = 250 by maybe 100ish`
- `thumbnail = 150 to 300 square-ish`

These are invalid compile-time inputs.

---

# 12. Reference TypeScript Definitions

## Formula node
```ts
type FormulaNode =
  | { type: 'const'; value: number }
  | { type: 'viewportWidth' }
  | { type: 'viewportHeight' }
  | { type: 'parentWidth' }
  | { type: 'parentHeight' }
  | { type: 'add'; a: FormulaNode; b: FormulaNode }
  | { type: 'sub'; a: FormulaNode; b: FormulaNode }
  | { type: 'mul'; a: FormulaNode; b: FormulaNode }
  | { type: 'div'; a: FormulaNode; b: FormulaNode }
  | { type: 'min'; a: FormulaNode; b: FormulaNode }
  | { type: 'max'; a: FormulaNode; b: FormulaNode }
  | { type: 'clamp'; value: FormulaNode; min: FormulaNode; max: FormulaNode }
  | { type: 'sameAsWidth' }
  | { type: 'sameAsHeight' }
  | { type: 'selectNearest'; value: FormulaNode; options: number[] };
```

## Canonical dimension spec
```ts
type CanonicalDimensionSpec = {
  id: string;
  width: FormulaNode;
  height?: FormulaNode;
  aspectRatio?: { numerator: number; denominator: number };
  fitMode?: 'fill' | 'contain' | 'cover' | 'stretch' | 'snap';
  anchor?: 'top-left' | 'top-center' | 'center' | 'bottom-center';
  snapMode?: 'none' | 'integer' | 'pixel';
  variants?: CanonicalDimensionSpec[];
};
```

## Bytecode instruction type
```ts
type BytecodeInstruction =
  | ['LOAD_CONST', string, number]
  | ['LOAD_VIEWPORT_WIDTH', string]
  | ['LOAD_VIEWPORT_HEIGHT', string]
  | ['LOAD_PARENT_WIDTH', string]
  | ['LOAD_PARENT_HEIGHT', string]
  | ['MOVE', string, string]
  | ['ADD', string, string, string]
  | ['SUB', string, string, string]
  | ['MUL', string, string, string]
  | ['DIV', string, string, string]
  | ['MIN', string, string, string]
  | ['MAX', string, string, string]
  | ['CLAMP', string, string, string, string]
  | ['ROUND', string, string]
  | ['SELECT_NEAREST', string, string, number[]]
  | ['SET_WIDTH', string]
  | ['SET_HEIGHT', string]
  | ['SET_ASPECT', number, number]
  | ['SET_FIT_MODE', string]
  | ['SET_ANCHOR', string]
  | ['SET_SNAP', string]
  | ['END'];
```

---

# 13. QA Checklist

## Parser QA
- [ ] `1920×1080` parses as fixed width and height
- [ ] `1200px–1440px` parses as a width range
- [ ] `16×16 to 32×32` parses as a bounded square family
- [ ] `A or B` becomes explicit variants

## Canonicalization QA
- [ ] every spec resolves to a supported canonical type
- [ ] no vague prose survives canonicalization
- [ ] width-only specs do not silently invent height
- [ ] every record contains snap mode

## Formula QA
- [ ] clamp formulas evaluate correctly
- [ ] aspect formulas derive correct dimensions
- [ ] square formulas map height to width correctly
- [ ] nearest-size selection works correctly

## Bytecode QA
- [ ] formula AST compiles into stable bytecode
- [ ] variants compile into distinct programs
- [ ] unsupported input fails loudly
- [ ] no instruction ambiguity exists in compiled output

## Runtime QA
- [ ] runtime executes bytecode and returns exact dimensions
- [ ] anchor mode applies after dimension computation
- [ ] fit mode applies consistently
- [ ] snap mode applies correctly per asset class

---

# 14. Risks

## 14.1 Overly loose authoring language
If PDR authors continue writing vague language, compiler failures will be frequent.

### Mitigation
Require a `Dimension Formula Contract` section in every serious PDR.

## 14.2 Hidden inference creep
If the compiler starts guessing too much, the system loses its formal integrity.

### Mitigation
Enforce a strict “no silent assumptions” policy in compile passes.

## 14.3 Bytecode sprawl
Too many custom instructions will make the compiler brittle.

### Mitigation
Keep the bytecode instruction set small, composable, and math-focused.

## 14.4 Responsive ambiguity
Responsive logic can easily turn into special-case spaghetti.

### Mitigation
Treat responsive behavior as variant compilation plus formula binding to viewport classes.

---

# 15. Definition of Done

This PDR is complete when:

- the parser can read the target dimension formats
- the canonical schema is finalized
- the formula AST is implemented
- bytecode compiler rules are defined
- runtime execution contract is documented
- invalid input behavior is specified
- the provided desktop/mobile/tablet/hero/thumbnail/logo/favicon examples are all represented and compilable

---

# 16. Next Step

The follow-up implementation document should be:

**Implementation Spec: `dimension-formula-compiler.ts`**

That spec should include:

- grammar
- parser tokens
- normalization rules
- AST builder
- bytecode emission
- runtime evaluator
- test fixtures
- golden snapshots for the example specs

