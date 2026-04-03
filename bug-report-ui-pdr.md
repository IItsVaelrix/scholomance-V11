PDR UI DOC
Collab Bug Cabinet
PixelBrain UI Logic Integration
Summary

Design the Collab Bug page as a PixelBrain-governed arcade cabinet interface where the central machine is the primary operational surface, the terminal screen is the canonical bug intelligence viewport, and every surrounding control obeys deterministic layout, symmetry, snap, timing, and state rules derived from PixelBrain systems. The page should not behave like a themed dashboard. It should behave like a machine-shaped bug orchestration console driven by bytecode, lattice, symmetry, and clock-synced interaction laws. This direction is grounded in your bytecode error system, symmetry AMP, coordinate symmetry processor, lattice grid engine, template grid engine, anti-alias/grid snap logic, and Gear-Glide timing system.

Why

The Bug page should be the most PixelBrain-native UI in Collab.

PixelBrain was created to remove ambiguity from UI decisions, and these modules already express the primitives needed to do that:

bytecode truth layer for deterministic error identity and recovery hints
snap and pixel-grid discipline for exact placement and anti-ambiguity rendering
symmetry detection and transformation for machine-level spatial order
lattice execution model for spatial debugging, occupancy, crisp interaction, and deterministic click resolution
template grid anchoring for symmetry axes, golden points, snapping, and control placement law
Gear-Glide timing for clock-smooth, BPM-locked motion instead of floaty generic animation

So the Bug page should be formalized as a UI where:

layout is computed, not vibes-based
motion is timed, not decorative
controls occupy governed anchor positions
spatial bug views are resolved through lattice logic
the cabinet metaphor is structurally useful, not cosmetic
Design Goal

Create a Bug page that feels like:

a deterministic arcade bug-hunt machine

Not:

a SaaS bug table
a themed admin page
a retro skin over ordinary cards

But:

a centered cabinet
a terminal intelligence core
a control deck with governed button geometry
side rails aligned through symmetry and anchor logic
live bug data rendered as machine-state
Core UI Identity
Name

PAC-OPS BUG CABINET

Product Metaphor

A bug-hunting arcade cabinet fused with PixelBrain’s deterministic rendering laws.

Visual Read
central arcade machine silhouette
terminal as machine screen
left and right support rails as machine wings
elegant control deck beneath the screen
subtle maze/lattice identity
bug routing feels like pursuit and containment
Functional Read
queue select
inspect
decode
verify
triage
assign
convert to task or pipeline
inspect spatial diagnostics
PixelBrain UI Logic
1. Layout Logic
Rule

All major layout decisions must be derived from PixelBrain anchor + symmetry logic, not arbitrary CSS spacing.

Governing logic

Use:

template anchor points
golden point placement
center anchor
vertical symmetry axis
grid snapping for major controls
Required anchors
cabinet_center
marquee_center
terminal_center
deck_center
left_wing_origin
right_wing_origin
golden_support_left
golden_support_right
Constraints
cabinet body is centered on viewport horizontal midline
marquee, screen, and deck share same cabinet axis
side rails mirror visually around the cabinet
major controls snap to a legal pixel/grid rhythm
cabinet proportions preserve silhouette across breakpoints
Risk reduced

Prevents drift into “close enough” admin layout.

2. Pixel Grid / Snap Logic
Rule

All visual geometry for the cabinet shell, screen frame, button deck, and support modules should obey PixelBrain snap rules.

Use:

snapValueToPixelGrid
snapToPixelGrid
integer-friendly coordinate resolution
Requirements
key cabinet edges should align to snapped values
button centers should snap consistently
terminal frame and marquee bounds should resolve to whole-pixel geometry
decorative linework must prefer crisp edges over soft transforms
Rendering principle

No blur-born “almost aligned” chrome. Cabinet reads as intentionally machined.

3. Symmetry Logic
Rule

The Bug page should be generated around a declared vertical symmetry axis, with optional controlled asymmetry only inside content payloads.

Use conceptual patterns from:

symmetry-amp.js
coord-symmetry-amp.js
template symmetry axes
Structural symmetry

Apply to:

cabinet silhouette
marquee
terminal bezel
action deck shell
left/right wing shell
support module framing
Allowed asymmetry

Only in:

queue item length
bug content volume
activity counts
recovery hint count
linked task/pipeline detail
Risk reduced

Keeps the arcade metaphor feeling like a real machine instead of a loose collage.

4. Timing / Motion Logic
Rule

All cabinet motion must use Gear-Glide timing principles:

time-based
smooth
clock-like
deterministic
optionally beat-pulsed
never mushy or spring-drunk
Motion zones
Marquee
slow pulse tied to system heartbeat or selected bug severity
Terminal
line reveals
severity flash
checksum verify sweep
tab changes with hard, machine-like motion
Deck controls
press compression
subtle activation ring
deterministic cooldown state
Selected bug target indicator
smooth rotational accent using getRotationAtTime()
Motion prohibitions

Do not use:

vague floating
elastic wobble for primary machine elements
random decorative motion
soft UI spring defaults as global behavior
Reduced motion mode
disable scan flicker
disable pulse expansion
preserve state changes with color and visibility only
5. Lattice Logic
Rule

The Bug page must treat spatial diagnostics as a real subsystem, using the lattice engine’s execution model for bug visualization and hit testing.

New module

Bug Lattice Map

This is a mini spatial panel that:

maps bug occurrences into cells
clusters duplicates
highlights critical failures
supports deterministic click resolution
optionally overlays symmetry diagnostics
Lattice behaviors to borrow
occupancy set semantics
crisp line rendering
grid-as-address-space logic
deterministic resolve-click
centered export/placement rules
Use on Bug page
repeated bug fingerprints become occupied cells
severity affects emphasis
selecting a cell updates terminal target
duplicate clusters share maze-like adjacency
Risk reduced

Creates a unique, system-native diagnostic experience instead of another filter sidebar.

6. Bytecode Logic
Rule

The terminal screen is a bytecode decoder first, prose view second.

Use the bytecode error system as canonical bug identity:

category
severity
module
code
checksum
recovery hints
invariants
Screen modes
summary
raw bytecode
decoded payload
invariants
linked objects
spatial diagnostics
Required terminal widgets
checksum verification badge
parseable badge
auto-fixable badge
module/code breakdown
copy bytecode
copy decoded JSON
verify action
create task action
start pipeline action
Specialized handling

Support COORDSYM faults distinctly using the coordinate symmetry error family:

invalid transform mode
missing symmetry axis
grid snap failed
coordinate out of bounds
7. Control Deck Logic
Rule

The machine deck beneath the terminal is not just a button row. It is a governed arcade control surface.

Layout

Three clusters:

Left cluster

Navigation / targeting

previous bug
next bug
queue focus
severity cycle
source filter
Center cluster

Primary machine actions

PARSE
VERIFY
TRIAGE
CREATE TASK
START PIPELINE
Right cluster

Resolution / routing

assign
mark duplicate
verify fixed
reopen
export JSON
copy bytecode
PixelBrain logic
cluster centers snap to symmetric anchor groups
primary actions have strongest weight at deck center
control spacing derived from a repeatable unit
no arbitrary margin drift
8. Template Grid Logic
Rule

Use template-grid principles for cabinet control placement and panel scaffolding.

Use cases
establish marquee bounds
define control deck columns
position side modules
align support labels
place decorative golden point markers
optionally support Fibonacci-guided secondary layout
Recommended grid modes
primary shell: rectangular
support ornament: Fibonacci accents
optional spatial diagnostics: rectangular or circular depending mode
Why

This lets the page feel governed by a formal UI law, which is exactly what PixelBrain is for.

9. Color Logic
Rule

The Bug page should use PixelBrain-compatible color hierarchy:

severity
module domain
verification state
machine shell accents

Use color logic inspired by:

color-byte mapping
palette generation
semantic/material-influenced rendering
Base palette
shell: obsidian / black lacquer
trim: muted amber-gold
terminal base: deep green-black / indigo-black
inactive controls: iron-grey / dark bronze
Severity overlay mapping
FATAL: void crimson / catastrophic red
CRIT: hot amber-red
WARN: electric amber
INFO: cyan-blue trace
Verification mapping
checksum good: green-cyan
checksum fail: hard red
parse failed: orange
auto-fixable: pale neon mint
10. Spatial Diagnostics Logic
Rule

The Bug page should expose a spatial diagnostics panel powered by symmetry and lattice logic.

Panel contents
symmetry type
significance/confidence
transform mode
overlap policy
bounds
coord-space
grid snap state
hotspot lattice
selected cell metadata
Special mode

When current bug is from COORDSYM or related transform modules:

switch terminal support panel to Symmetry Fault Mode
emphasize axis, transform mode, snapped coordinates, bounds failure, recovery invariants
11. Page Information Architecture
Left Wing
Purpose

Target acquisition and bug queue navigation.

Modules
queue rail
severity filter
status filter
source filter
dedupe toggle
checksum-failed-only toggle
Center Cabinet
Purpose

Primary intelligence surface.

Modules
marquee
terminal screen
control deck
small status foot
Right Wing
Purpose

Support intelligence and routing.

Modules
checksum shrine
triage routing module
recovery hints module
linked task/pipeline module
spatial diagnostics module
12. Terminal Screen Structure
Header strip
bug title
severity
category
module
code
checksum state
parseable state
occurrence count
Main body

Tab-based terminal panes:

SUMMARY
BYTECODE
DECODE
INVARIANTS
SPATIAL
LINKS
ACTIVITY
Footer strip

Hotkeys and action hints:

T create task
P start pipeline
A assign
D duplicate
C copy bytecode
V verify checksum
13. Responsive Logic
Desktop
full cabinet silhouette preserved
side wings visible
lattice map visible
control deck one-row primary layout
Tablet
cabinet remains centered
support wings collapse into stacked trays
terminal remains dominant
control deck may become two rows
Mobile
cabinet silhouette simplified but preserved
wings become drawers or collapsible shelves
terminal becomes dominant vertical stack
buttons reorganized into compact grid
lattice panel becomes optional tab
Rule

Responsive collapse must preserve cabinet identity and PixelBrain symmetry law as much as possible.

14. State Logic
Empty state

Machine powered but no bug loaded:

terminal says NO TARGET LOADED
prompt to select bug or paste bytecode
Parse failure state
checksum/error panel escalates
terminal shows structure failure and required next step
Critical incident state
marquee intensifies
terminal border severity increases
right-rail routing module prioritizes immediate task/pipeline action
Duplicate cluster state
lattice panel shows concentration
queue cards marked with occurrence badge
15. Component Spec

Recommended components:

BugPageCabinetShell
BugMarquee
BugTerminalViewport
BugDeckControls
BugQueueRail
BugSupportRail
BugChecksumShrine
BugRoutingModule
BugRecoveryModule
BugSpatialDiagnostics
BugLatticeMap
BugSeverityIndicator
BugBytecodePanel
QA Checklist
Layout
 cabinet remains centered at all breakpoints
 marquee, screen, and deck share axis
 major controls snap cleanly
 left/right wing visual balance is preserved
 cabinet silhouette does not collapse into generic dashboard boxes
Motion
 motion uses Gear-Glide style smooth timing
 no floaty spring drift on machine shell
 reduced motion mode works cleanly
 selection pulse and LED states remain readable
Bytecode
 raw bytecode view is copyable
 checksum verification state is visible
 decoded payload renders correctly
 invariants and hints display without layout breakage
Spatial
 lattice hotspot map resolves clicks deterministically
 symmetry data is surfaced for relevant bugs
 COORDSYM bugs render specialized support info
 duplicate clustering works visually
Control Deck
 primary actions are reachable and visually prioritized
 keyboard hints make sense
 buttons feel like machine controls, not loose pills
Next Risks

The biggest risk is translating “PixelBrain UI logic” into decoration instead of law. If the cabinet ends up merely looking arcade-like while spacing, motion, targeting, and control placement are still hand-wavy, the whole point is lost.

The second biggest risk is overloading the center terminal with too much raw payload at once. Keep the cabinet screen dense, but tiered. Summary first, bytecode truth one click deeper, spatial mode when relevant.

If you want, I can turn this into a React component architecture doc next, with exact component responsibilities and prop contracts.