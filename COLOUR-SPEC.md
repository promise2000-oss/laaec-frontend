# COLOUR-SPEC — LAEC Exact Colour Specification

> Generated 2026-09-28 from `LAEC-Colour-Spec.pdf` (12 pages) with pdf-parse 2.4.5, per decision D-02.
> Source document extracted 2026-09-26 by reading declared CSS custom properties, literal colour values and
> `getComputedStyle()` on live rendered elements.
> This file is the colour and typography source of truth for the build. Review before use — extraction is
> verbatim text and does not reconstruct the PDF's tables; where layout is lost, the PDF governs.

## Page 1

LAEC — Exact Colour Specification
Extracted 2026-09-26 by reading declared CSS custom properties, literal colour values from every stylesheet and inline
<style> , and getComputedStyle() on live rendered elements.
All values are as declared / as resolved by the browser. Where a page declares a token and the computed value differs,
both are shown.
CONTENTS
1. The headline finding: there is no single brand palette
2. Public + control pages — "Glass" theme ( / , /login/ , /control/ )
2.1 Declared tokens
2.2 Core palette (resolved)
2.3 Backgrounds — three different photos, one per page
2.4 Bubble field — identical on all three pages
2.5 Homepage elements (computed)
2.6 Login page elements (computed)
2.7 Other literals on /login/
2.8 Control page elements (computed)
3. Exam hall — the " nj " light theme ( /exam/ )
3.1 Computed elements
3.2 Question navigator and options (declared)
3.3 Other literals on /exam/
4. Admin consoles — the 15-token system ( /admin/ , /ca/ , /ict/ , /comm/ )
4.1 Page background — computed
4.2 Sidebar — dark, gradient
4.3 Header
4.4 Buttons — all gradient-filled, radius 14px , weight 800
4.5 Mode / toggle buttons
4.6 Tables
4.7 Form controls
4.8 KPI numerals
4.9 Chart palette — DEFAULT_COLORS in /dashboard-overview.js
4.10 Answer-script modal (built in JS, inline styles)
4.11 Other admin literals worth naming
5. Typography (for completeness — the other half of the visual system)
6. Colour-related observations for the PRD
7. How this was extracted
1. The headline finding: there is no single brand palette
The site ships three unrelated colour systems and no shared token file. The CSS custom property --laec-blue alone has
two different values depending on which page you are on:
Page 	--laec-blue 	Accent token 	Nature of the design
/ 	#004a99 	--laec-accent: #00c2ff 	Dark glassmorphism over photo
/login/ 	#004a99 	--laec-accent: #00c2ff 	Dark glassmorphism over photo
/exam/ 	#004a99 	none — uses --nj-* 	Light, flat, Bootstrap-ish

---

## Page 2

Page 	--laec-blue 	Accent token 	Nature of the design
/control/ 	#004a99 	--laec-accent: #00c2ff 	Dark glassmorphism over photo
/admin/ /ca/ /ict/ /comm/ 	#123a63 	--laec-accent: #4ec6ff 	Light, dense enterprise
So the public/portal surface is bright cyan-on-navy glass; the admin surface is a darker, desaturated navy with a much
larger, 15-token system; and the exam hall is an entirely different light theme that does not even use the accent token.
2. Public + control pages — "Glass" theme ( / , /login/ , /control/ )
2.1 Declared tokens
Token 	/ 	/login/ 	/control/
--laec-blue 	#004a99 	#004a99 	#004a99
--laec-accent 	#00c2ff 	#00c2ff 	#00c2ff
--white 	#ffffff 	#ffffff 	—
--glass 	rgba(255,255,255,0.12) 	rgba(255,255,255,0.9) 	—
--glass-heavy 	rgba(255,255,255,0.2) 	— 	—
--danger 	— 	#dc3545 	#dc3545
--success 	— 	#28a745 	#28a745
--bg 	— 	— 	#f4f7fa
Note the --glass collision: on / it means a translucent white overlay ( rgba(255,255,255,0.12) ); on /login/ the same
token name means an opaque white card ( rgba(255,255,255,0.9) ). Same name, opposite meaning.
2.2 Core palette (resolved)
Role 	Hex 	RGB 	Where
Primary blue 	#004a99 	rgb(0, 74, 153) 	Buttons, labels, h2, h1, tick marks
Accent cyan 	#00c2ff 	rgb(0, 194, 255) 	Vendor link, bubble highlights, radial glow
Deep navy (page base) 	#0b2f57 	rgb(11, 47, 87) 	body background on / and /control/
Deeper navy 	#001f3f 	rgb(0, 31, 63) 	End stop of the overlay gradient
Mid navy 	#003366 	rgb(0, 51, 102) 	End stop of the /login/ overlay
White 	#ffffff 	rgb(255, 255, 255) 	Headings, body copy, button text
Danger red 	#dc3545 	rgb(220, 53, 69) 	Error text, "PORTAL CLOSED", alert border
Success green 	#28a745 	rgb(40, 167, 69) 	Success messages
Gradient dark text 	#003366 	— 	.nicegene-brand on /control/
2.3 Backgrounds — three different photos, one per page
This was not documented anywhere in the source as a shared asset; each page hardcodes its own.
/ — homepage

---

## Page 3

body 	background-color: #0b2f57
body::before background-image: url("https://images.unsplash.com/photo-1523240798132-875721a3afc3?
auto=format&fit=crop&w=1600&q=80")
background-size: cover; position: fixed; inset: 0; z-index: -3
body::after 	background-image:
radial-gradient(circle at 0% 0%, rgba(0,194,255,0.18), rgba(0,0,0,0) 28%),
linear-gradient(rgba(0,74,153,0.68), rgba(0,31,63,0.86))
/login/ — student portal (different photo, different overlay)
body 	background-color: transparent <-- no solid base at all
body 	background-image:
linear-gradient(rgba(0,74,153,0.8), rgba(0,51,102,0.9)),
url("https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-
1.2.1&auto=format&fit=crop&w=1950&q=80")
html and body both compute to rgba(0,0,0,0) — the gradient is painted on body itself, not on a pseudo-element.
There is no #0b2f57 fallback on this page.
/control/ — admin login
body 	background-color: #0b2f57
body::before url("https://images.unsplash.com/photo-1517048676732-d65bc937f952?
auto=format&fit=crop&w=1600&q=80")
body::after 	radial-gradient(circle at 0% 0%, rgba(0,194,255,0.18), rgba(0,0,0,0) 28%),
linear-gradient(rgba(0,74,153,0.68), rgba(0,31,63,0.86))
Identical overlay to the homepage, different photograph.
Page 	Unsplash photo
/ 	photo-1523240798132-875721a3afc3
/login/ 	photo-1516321318423-f06f85e504b3
/control/ 	photo-1517048676732-d65bc937f952
2.4 Bubble field — identical on all three pages
Part 	Value
Fill 	rgba(255, 255, 255, 0.08)
Border 	1px solid rgba(255, 255, 255, 0.32)
Highlight gradient 1 	radial-gradient(circle at 30% 24%, rgba(255,255,255,0.9) 0 8%, transparent 9%)
Highlight gradient 2 	radial-gradient(circle at 70% 78%, rgba(0,194,255,0.18), transparent 35%)
Inner shadow 	inset 0 0 18px rgba(255,255,255,0.28)
Inner shadow 2 	inset -10px -14px 28px rgba(0,194,255,0.08)
Outer shadow 	0 10px 34px rgba(0,0,0,0.08)
2.5 Homepage elements (computed)
Element 	Colour 	Also
h1 	#ffffff 	28.8px, weight 800, text-transform: uppercase , letter-
spacing: -1px

---

## Page 4

Element 	Colour 	Also
.welcome-text 	#ffffff 	17.6px / 28.16px line-height
a.nicegene-brand 	#00c2ff 	text-decoration: none
.action-card bg 	rgba(255,255,255,0.12) 	backdrop-filter: blur(15px) , radius 24px
.action-card border 	1px solid
rgba(255,255,255,0.25)
.action-card shadow 	0 10px 30px rgba(0,0,0,0.1)
.action-card.admin-card
bg
rgba(0,0,0,0.2) 	same border
.icon-box 	#ffffff , transparent bg 	40px emoji
.card-title 	#ffffff 	20.8px, weight 800, uppercase
.card-desc 	#ffffff 	13.6px
footer 	rgba(255,255,255,0.6) 	12px
2.6 Login page elements (computed)
Element 	Colour 	Also
.login-card bg 	rgba(255,255,255,0.9) 	backdrop-filter: blur(10px) , radius
20px
.login-card border 1px solid rgba(255,255,255,0.3)
.login-card shadow 0 15px 35px rgba(0,0,0,0.3)
.login-card h2 	#dc3545 	17.92px, weight 800, uppercase
.subtitle 	rgb(85,85,85) = #555 	13.12px
label 	rgb(0,74,153) = #004a99 	12px, weight 700, uppercase
input text 	#000
input bg 	#ffffff
input border 	rgb(221,221,221) = #ddd 	radius 8px , padding 11px 12px
button.btn-login
text
#ffffff 	15.36px, weight 700, uppercase
button.btn-login
bg
rgb(0,74,153) = #004a99 	radius 8px , border 1px solid #ffffff
#error-msg 	#dc3545 	13.6px
#loader 	border-top-color: #004a99 , track #f3f3f3 	30×30px
#offline-ui h2 	#dc3545 	17.92px
.laec-alert-box 	bg #ffffff , border #000 , radius 15px
.graduate-badge 	bg rgba(40,167,69,0.12) , text/border rgb(22,114,58) =
#16723a
radius 999px
#print-slip 	bg #ffffff , text #000 	16px
The login card heading is red, not blue. h2 "Student CBT Portal" computes to #dc3545 , the same value as --danger . On
/control/ the equivalent h2 is rgb(0,74,153) — the primary blue. So the student and admin login cards use the same
token names but different heading colours.

---

## Page 5

2.7 Other literals on /login/
#f1f4f8 #f8fbff #eef5ff #cfe3ff #f1f4f8 (input focus / tinted surfaces)
#cbd5e0 #718096 #a0aec0 #1f3654 #4e4d4d (greys and slate text)
#f3f3f3 #777777 #666 #888 	(loader track, muted text)
#fff5f5 #feb2b2 #c53030 	(no-active-exam red panel)
rgba(40,167,69,0.12) #16723a 	(graduate badge)
rgba(119,119,119,0.12) 	(password field eye background)
The "no active examination" panel in the subject hallway is built from #fff5f5 background, #feb2b2 border, #c53030 text
— a second, different red from --danger #dc3545 .
2.8 Control page elements (computed)
Element 	Colour 	Also
body 	#0b2f57 + photo + overlay
.login-card bg 	rgba(255,255,255,0.96) 	radius 15px , no backdrop-filter
.login-card shadow 	0 15px 35px rgba(0,0,0,0.16)
.login-card h2 	rgb(0,74,153) = #004a99 	22.4px, weight 800, not uppercased
.req-item 	rgb(119,119,119) = #777777 	11px
.req-item span border 	#777777
#loader 	border-top-color: #004a99 , track #f3f3f3 	22×22px
.modal-overlay 	rgba(0,0,0,0.6)
.modal-box 	bg #ffffff , radius 12px
3. Exam hall — the " nj " light theme ( /exam/ )
A separate 6-token system. Only --laec-blue is shared with the public pages; the accent cyan is not used here at all.
Token 	Value 	RGB 	Used for
--laec-blue 	#004a99 	rgb(0, 74, 153) 	Primary actions, accents, current question
--nj-dark 	#2c3e50 	rgb(44, 62, 80) 	Dark text
--nj-bg 	#f4f7f6 	rgb(244, 247, 246) 	Page background (body)
--nj-success 	#27ae60 	rgb(39, 174, 96) 	Answered question, score ring
--nj-border 	#dee2e6 	rgb(222, 226, 230) 	All card and input borders
--nj-danger 	#d32f2f 	rgb(211, 47, 47) 	Lockdown banner, submit button
--nj-warning 	#f39c12 	rgb(243, 156, 18) 	Offline timer state
Page background is #f4f7f6 — a very slightly green-tinted off-white, unlike the admin's #eef5fb . The exam is the only
light-themed page a student ever sees, and it shares no tokens with the login screen they arrived from.

---

## Page 6

3.1 Computed elements
Element 	Colour 	Also
body 	rgb(244,247,246) = #f4f7f6 	font "Segoe UI", Tahoma, Geneva, Verdana, sans-
serif — not Inter
#instructionTitle 	#004a99 	32px, weight 700
#systemInstructionC
ard
bg rgb(249,249,249) , border #ddd , radius 12px inset 0 2px 5px rgba(0,0,0,0.05)
.rules-list li 	#444 	14px / 19.6px
.rules-list strong #444 	14px
.rules-list
li::before
#004a99 , content "✓"
#nextInstructionBt
n
bg #004a99 , text #ffffff , border #ffffff ,
radius 6px
13.33px, weight 700, uppercase
#proceedBtn
(disabled)
bg #cccccc , text #777777 , border #777777 ,
radius 8px
cursor: not-allowed
#secBanner 	bg rgb(211,47,47) , text #ffffff 	13.6px, weight 800, letter-spacing: 1px
#mainHeader 	bg #004a99 , text #ffffff 	position: sticky , 0 2px 10px rgba(0,0,0,0.1)
#timer 	text rgb(255,255,0) , bg #000000 	22.4px, weight 700, font-family: monospace , radius
5px
.timer-box
(declared)
background: #000; color: #ff0; border: 2px
solid white
radius 5px
.timer-box.offline color: var(--nj-warning) , border-color: var(-
-nj-warning)
#f39c12
#qLabel 	#004a99 	14.4px, weight 800
#qText 	rgb(51,51,51) = #333 	22.4px / 35.84px
.sidebar 	bg #ffffff , border #dee2e6 , radius 10px 	0 2px 15px rgba(0,0,0,0.05)
.student-reg-tag 	var(--laec-blue) = #004a99
.btn-submit 	bg rgb(211,47,47) = #d32f2f , text #ffffff ,
radius 6px
.modal-overlay 	rgba(0,0,0,0.9)
.modal-box 	bg #ffffff , radius 12px 	0 20px 60px rgba(0,0,0,0.3)
#percentCircle 	rgb(39,174,96) = #27ae60 	120×120px, border-width: 6px
The timer is pure #ffff00 yellow on #000000 black — the only pure black/primary-yellow pair on the entire site, and
completely outside the design system.

---

## Page 7

3.2 Question navigator and options (declared)
.q-box 	{ border: 1px solid var(--nj-border); border-radius: 5px; background: white }
.q-box.current 	{ border: 2.5px solid var(--laec-blue); color: var(--laec-blue);
background: #eef5ff }
.q-box.answered 	{ background: var(--nj-success); color: white; border-color: var(--nj-success) }
.q-box.theory 	{ background: var(--laec-blue); color: white }
.question-container { background: white; border-radius: 10px; box-shadow: 0 2px 15px rgba(0,0,0,0.05);
border: 1px solid var(--nj-border) }
.option-label 	{ border: 1px solid var(--nj-border); border-radius: 8px }
.option-label:hover { background: #f8f9fa; border-color: var(--laec-blue) }
.option-label.selected { border-color: var(--laec-blue); background: #eef5ff }
.sub-objective-input 	{ border: 1px solid var(--nj-border); border-radius: 8px;
color: #222; background: #fff }
.sub-objective-input:focus { border-color: var(--laec-blue);
box-shadow: 0 0 0 3px rgba(0,86,179,0.12) }
.sub-objective-hint 	{ color: #667085 }
.btn-prev 	{ background: #eee; color: #555 }
.btn-next 	{ background: var(--laec-blue); color: white }
.theory-notice { background: #fff3cd; border: 2px dashed #856404; color: #856404; border-radius: 8px }
#eef5ff appears on both /exam/ and /login/ — the same "selected" tint, hardcoded in two unrelated stylesheets,
neither using a token.
3.3 Other literals on /exam/
#222 #333 #444 #555 #666 #777 #888 #ccc #ddd #eee #f9f9f9 #f8f9fa
#fff3cd #856404 	(theory notice — Bootstrap's warning pair)
#667085 	(sub-objective hint)
#eef5ff 	(selected tint)
rgba(0,86,179,0.12) 	(focus ring)
rgba(0,0,0,0.05) rgba(0,0,0,0.1) rgba(0,0,0,0.3) rgba(0,0,0,0.9)
rgba(255,255,255,0.2) rgba(0,0,0,0.28) #ff0
#fff3cd / #856404 and #f8f9fa are verbatim Bootstrap 4 warning and hover values, yet no Bootstrap is loaded (see PRD
§1.3). These are copy-paste residue.
4. Admin consoles — the 15-token system ( /admin/ , /ca/ , /ict/ , /comm/ )
All four share an identical :root block.
Token 	Value 	RGB 	Role
--laec-blue 	#123a63 	rgb(18, 58, 99) 	Primary brand, header text, tab text
--laec-blue-deep 	#0b2242 	rgb(11, 34, 66) 	Gradient end stop, dark text
--laec-accent 	#4ec6ff 	rgb(78, 198, 255) 	Cyan accent, glows, focus
--bg-light 	#f2f6fb 	rgb(242, 246, 251) 	Gradient start
--bg-soft 	#e8f0f8 	rgb(232, 240, 248) 	Soft surface
--white 	#ffffff 	— 	Cards

---

## Page 8

Token 	Value 	RGB 	Role
--text-dark 	#15243d 	rgb(21, 36, 61) 	Body text
--text-soft 	#5f7087 	rgb(95, 112, 135) 	Table headers, muted text
--success 	#11895f 	rgb(17, 137, 95) 	Success buttons, portal ON
--danger 	#c44444 	rgb(196, 68, 68) 	Danger buttons, logout drawer
--border 	#d8e3f0 	rgb(216, 227, 240) 	Table rules, card borders
--warning 	#f1b844 	rgb(241, 184, 68) 	Warning buttons, MODE B active
--shadow 	0 18px 45px rgba(12,38,69,0.12) 	— 	Card elevation
--laec-sidebar-width 	292px 	— 	Layout
--laec-topbar-height 	82px 	— 	Layout
The last two are defined in /admin-sidebar.css , not the page :root .
4.1 Page background — computed
body { background-image:
radial-gradient(circle at 0% 0%, rgba(78,198,255,0.18), rgba(0,0,0,0) 28%),
radial-gradient(circle at 100% 12%, rgba(17,137,95,0.12), rgba(0,0,0,0) 24%),
linear-gradient(rgb(238,245,251) 0%, rgb(249,251,253) 52%, rgb(238,244,250) 100%);
background-color: rgba(0,0,0,0);
font-family: Manrope, "Segoe UI", sans-serif; }
Two radial glows (cyan top-left, green top-right) over a vertical #eef5fb → #f9fbfd → #eef4fa gradient.
4.2 Sidebar — dark, gradient
.nav-container {
background-image: linear-gradient(rgb(8,17,31) 0%, rgb(13,27,49) 54%, rgb(16,40,70) 100%);
width: 292px;
box-shadow: 16px 0px 42px rgba(8,17,31,0.26);
border-right: 1px solid rgba(255,255,255,0.08);
}
Sidebar colour 	Value
Gradient stops 	#08111f → #0d1b31 (54%) → #102846
Tab text 	#ffffff
Tab fill 	rgba(255,255,255,0.1)
Tab border 	1px solid rgba(255,255,255,0.12)
Muted sidebar text 	#dce8ff , rgba(218,230,255,0.68) , rgba(226,235,255,0.84)
Blue focus text 	#2e7df6
Drawer logout fill 	rgba(196,68,68,0.16) (danger at 16%)
Tab typography: 11.84px, weight 800, letter-spacing: 0.9472px , text-transform: uppercase , radius 14px , padding
13.12px 14.4px 13.12px 49.28px .

---

## Page 9

4.3 Header
Part 	Value
Background 	rgba(255,255,255,0.94)
Text 	rgb(18,58,99) = #123a63
Shadow 	0 12px 32px rgba(11,34,66,0.1)
.brand 	#123a63 , 16px, weight 700, letter-spacing: 0.64px
.logout-btn-header 	bg #123a63 , text #ffffff , border rgba(255,255,255,0.85) , radius 8px , 12.16px weight 800
4.4 Buttons — all gradient-filled, radius 14px , weight 800
Class 	Gradient 	Text 	Shadow
.btn-primary 	linear-gradient(135deg, #123a63,
#0b2242)
#ffffff 	0 14px 24px rgba(18,58,99,0.18)
.btn-success 	linear-gradient(135deg, #16a06f,
#11895f)
#ffffff 	0 14px 24px rgba(17,137,95,0.2)
.btn-danger 	linear-gradient(135deg, #db6666,
#c44444)
#ffffff 	0 14px 24px
rgba(196,68,68,0.18)
.btn-warning 	linear-gradient(135deg, #f7c948,
#d99a00)
rgb(11,34,66) =
#0b2242
0 14px 24px
rgba(217,154,0,0.22)
.btn-
secondary
none — rgba(255,255,255,0.1) 	#ffffff 	none
Every button also has border: 1px solid #ffffff (except warning, which uses #0b2242 ). .btn-primary letter-spacing
0.533333px , 13.33px.
The hover/end-stop colours #16a06f , #db6666 , #f7c948 , #d99a00 are hardcoded and are not in :root — only their
darker partners #11895f , #c44444 , #f1b844 are tokens.
4.5 Mode / toggle buttons
Element 	Background 	Text 	Border 	Shadow
.mode-btn (default) 	transparent 	#ffffff 	1px solid
#ffffff
none
#mode-b-btn (MODE B
active)
rgb(241,184,68) =
#f1b844
rgb(47,36,0) =
#2f2400
#2f2400 	0 12px 20px
rgba(241,184,68,0.24)
#portal-on-btn
(PORTAL ON)
rgb(17,137,95) =
#11895f
#ffffff 	#ffffff 	0 12px 20px
rgba(17,137,95,0.24)
#2f2400 (near-black brown) exists solely as the active-MODE-B text/border colour. It appears nowhere else. Radius 12px ,
11.84px, weight 800, letter-spacing: 0.7104px .
4.6 Tables
Part 	Value
thead th text 	rgb(95,112,135) = #5f7087
thead th background 	rgba(18,58,99,0.04)

---

## Page 10

Part 	Value
thead th typography 	11.52px, weight 700, uppercase, letter-spacing: 1.3824px
thead th bottom rule 	rgba(216,227,240,0.9)
tbody td text 	rgb(21,36,61) = #15243d
tbody td font size 	14.72px
tbody td bottom rule 	rgba(216,227,240,0.72)
tbody td background 	transparent
4.7 Form controls
select, input[type=text] {
color: #15243d;
background-color: rgba(248,251,255,0.95);
border: 1px solid rgba(18,58,99,0.14);
border-radius: 14px;
font-size: 15.2px;
padding: 13px 14px;
}
Component 	Colours
.exam-sync-pill 	text #0b2242 , bg rgba(18,58,99,0.06) , border rgba(18,58,99,0.08) , radius 999px , 11.84px
.exam-sync-mini 	text #0b2242 , bg rgba(255,255,255,0.94) , border rgba(18,58,99,0.1) , radius 12px , 11.52px
.back-to-top 	text #ffffff , transparent bg, border #ffffff , radius 14px , 0 16px 32px rgba(11,34,66,0.26)
#custom-alert overlay 	rgba(7,17,31,0.6)
#loading-overlay 	rgba(247,250,253,0.82) , text #15243d
footer 	#15243d , 16px, bg #d8e3f0
4.8 KPI numerals
#count-total { color: rgb(11,34,66) = #0b2242; font-size: 33.6px; font-weight: 700;
font-family: "Space Grotesk", Manrope, sans-serif; }
The only place Space Grotesk is applied as a rendered face rather than a fallback.
4.9 Chart palette — DEFAULT_COLORS in /dashboard-overview.js
The exact ordered array consumed by Chart.js, cycled by getColors(count) :
# 	Hex 	Name
1 	#123a63 	deep navy (= --laec-blue )
2 	#4ec6ff 	cyan (= --laec-accent )
3 	#11895f 	green (= --success )
4 	#f1b844 	amber (= --warning )
5 	#ff8c42 	orange
6 	#8f5cff 	violet

---

## Page 11

# 	Hex 	Name
7 	#ef476f 	pink
8 	#06d6a0 	mint
9 	#26547c 	slate blue
10 	#ffd166 	pale yellow
The first four are the design tokens, in order. Entries 5–10 are a one-off categorical set that exists only in JavaScript and is
not reflected in any CSS.
4.10 Answer-script modal (built in JS, inline styles)
The per-student answer-script print view constructs its own styles, bypassing the token system:
body 	{ color: #17233f }
h1 	{ color: #0f3766 } 	<-- a FIFTH blue
.script-row { border: 1px solid #d9e2ef }
print button { background: #0f3766; color: #fff; border-radius: 8px }
header border-bottom: 1px solid #e5edf6
footer border-bottom: 1px solid #edf2f7
#0f3766 appears on all four admin pages, exclusively inside the answer-script modal, and is not in :root . Alongside
#123a63 and #17233f , the admin console therefore carries three different navy blues for text.
4.11 Other admin literals worth naming
#eef5fb #f9fbfd #eef4fa #f7f9fc #f8fbff #eef2f7 #edf2f7 #f0fff4
#e5edf6 #eef3f8 #e1e8f0 #dbe6f2 #d9e2ef #cfd8e3 #ccd6e4 #cbd5e1 #cbd5e0
#eef5ff 	<-- shared with /exam/
#17233f #2d3748 #4a5568 #344054 #475467 #7f8c8d #7f8c9d #99 #111 #555 #666 #777 #888
#f0f0f0 #f5f5f5 #f3f3f3
#fff5f5 #c53030 #f0f0f0 	(danger panels)
#fffaf0 #feebc8 #946200 	(warning panels, /comm/ only)
#16a06f #db6666 #f7c948 #d99a00 #2f2400
#2e7df6 	(admin-sidebar.css only)
#f8f9fc 	(question-management.js)
#ffffff 	(dashboard-registration.js)
5. Typography (for completeness — the other half of the visual system)
Surface 	Stack 	Loaded from
/ 	Inter, sans-serif 	Google Fonts, weights 400/600/800
/login/ 	Inter, "Segoe UI", sans-serif 	same
/control/ 	Inter, sans-serif 	same
/exam/ 	"Segoe UI", Tahoma, Geneva, Verdana, sans-serif 	none — system stack, no webfont
/exam/ timer 	monospace 	system
All 4 admin 	Manrope, "Segoe UI", sans-serif 	Google Fonts, Manrope 400/500/700/800
Admin KPI numerals 	"Space Grotesk", Manrope, sans-serif 	Google Fonts, Space Grotesk 500/700

> **Correction (2026-09-28, decision D-25):** rows for `/login/` and `/control/` are wrong in
> the "Loaded from" column. The live origin carries **no** Google Fonts link on either page
> (`googleapis` references: 0 on both, verified against the fetched documents), so Inter is
> never loaded there and the stack silently renders `Segoe UI`. Only `/` loads
> `family=Inter:wght@400;600;800`. The build replicates this as observed.

---

## Page 12

The exam hall — the highest-stakes screen, and the one with the most custom sizing — is the only page with no webfont at
all, and it is the only page whose body font is not Inter.
6. Colour-related observations for the PRD
These are new findings; they are not in PRD.md §6 as written.
# Finding
C1 --laec-blue has two meanings: #004a99 (public) and #123a63 (admin). Any shared component or future extraction will break
unless the token is renamed.
C2 --glass has two meanings: rgba(255,255,255,0.12) (translucent overlay) on / vs rgba(255,255,255,0.9) (opaque card) on
/login/ .
C3 Three unrelated background systems: dark-blue glass (public), light #f4f7f6 + nj tokens (exam), light blue-grey gradient + 15
tokens (admin). The student journey crosses two of them ( /login/ → /exam/ ) with no shared palette.
C4 Three different Unsplash photos, hardcoded per page, none of them a brand asset.
C5 Bootstrap 4 residue with no Bootstrap loaded: #fff3cd / #856404 (warning), #f8f9fa (hover), #f1f4f8 (light), #dddddd
(border) on /exam/ and /login/ .
C6 At least five distinct reds: #dc3545 , #c53030 , #d32f2f , #c44444 , #db6666 , plus #feb2b2 as a border. At least five greens:
#28a745 , #16723a , #27ae60 , #11895f , #16a06f , #06d6a0 , #f0fff4 .
C7 Four different navies for text: #004a99 , #123a63 , #0b2242 , #0f3766 , plus #17233f , #15243d , #1f3654 , #2c3e50 .
C8 The exam timer is #ffff00 on #000000 — the only pure black/primary-yellow pair on the site, entirely outside the design system.
C9 Chart palette entries 5–10 ( #ff8c42 , #8f5cff , #ef476f , #06d6a0 , #26547c , #ffd166 ) exist only in JS and are not mirrored in
CSS, so charts and UI cannot be kept in sync.
C10 /login/ has no solid background colour — body and html both compute to transparent, with the gradient + photo on body
only. If the photo fails to load, there is no #0b2f57 fallback (unlike / and /control/ ).
C11 #eef5ff (the "selected" tint) is hardcoded in two unrelated stylesheets ( /exam/ and /login/ ) and is not a token.
C12 #2f2400 — a near-black brown used only as the active MODE B text and border. No relationship to any other token.
7. How this was extracted
Method 	Used for
Regex over raw HTML of all 8 pages 	every declared colour literal, with occurrence counts
:root parsing per page 	the token tables in §2.1, §3, §4
fetch() of the 3 external CSS files 	/admin-sidebar.css , /exam-session-controls.css , /dashboard-
registration.css
Regex over /dashboard-overview.js 	DEFAULT_COLORS chart palette
getComputedStyle() on live rendered
elements
all "computed" tables — resolves every token to actual RGB
::before / ::after computed styles 	background layers and gradients
CSS-rule scanning for unrendered elements 	.q-box , .option-label , .theory-notice (no live node exists without a loaded
paper)
Caveat. #eef5ff , #856404 , #667085 and similar were read from declared CSS, not computed, because those elements
require a loaded question paper, which requires live credentials. Values are verbatim from the stylesheet.
