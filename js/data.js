'use strict';
// ─────────────────────────────────────────────────────────────
//  MVSR College Life RPG — static game data
// ─────────────────────────────────────────────────────────────

let WORLD_W = 1800, WORLD_H = 3700;   // `let` so a layout saved in the Map Editor can resize the world
const TIME_SCALE = 1.5;          // game minutes per real second
const LAST_DAY = 12;

// ── Campus layout ──
// Seen from the main gate: turned 90° anticlockwise from a north-up map, so real-life west is at the bottom
// (where the gate is), north on the left, east at the top and south on the right. Directions below are screen directions.
// The hand-drawn picture assets/campus_map.png is the base map (drawn in art.js); its red background was made
// transparent, so the game's grass, trees, buildings and everything placed here show through it.
// ROADS follow the picture's painted asphalt: road A (left, two carriageways around a lawn median), road B (right),
// the two roads along the top, the horizontal road and the bottom road in front of the gate.
// Everything else is the original layout from before the picture — move it around in the Map Editor (editor.html).
// Buildings: visual rect (x,y,w,h). face = which way the front wall faces ('S' = towards the gate, 'N', 'E', 'W'),
// door = which side the entrance is on, doorAt = 0.1–0.9 along that side.
// `roof` = roof depth towards the front wall; on gate-facing buildings the roof is walk-behind space.
const BUILDINGS = [
  { id: 'hostel', name: 'Girls Hostel', x: 40, y: 3290, w: 290, h: 350, roof: 298, wall: '#e9c46a', roofC: '#9c4a2f', floors: 3, deco: 'tanks', face: 'N', door: 'N' },
  { id: 'hostel2', name: 'Boy Hostel', x: 1190, y: 3315, w: 420, h: 295, roof: 243, wall: '#e7b98f', roofC: '#7a3b2e', floors: 3, deco: 'tanks', door: 'N', face: 'N' },
  { id: 'canteen', name: 'Canteen', x: 1280, y: 1930, w: 230, h: 290, roof: 192, wall: '#f4f1de', roofC: '#e07a5f', floors: 1, deco: 'awning', door: 'W', face: 'W', doorAt: 0.5 },
  { id: 'audi', name: 'ECE', x: 490, y: 1615, w: 390, h: 295, roof: 337, wall: '#d8e2dc', roofC: '#6d597a', floors: 1, deco: 'stripes', door: 'W', face: 'W', doorAt: 0.5 },
  { id: 'blockA', name: 'CSE Block', x: 580, y: 1992, w: 328, h: 308, roof: 262, wall: '#f2e8cf', roofC: '#bc4749', floors: 2, deco: 'solar', door: 'W', face: 'W', doorAt: 0.5 },
  { id: 'blockB', name: 'Mech block', x: 540, y: 2370, w: 390, h: 390, roof: 337, wall: '#edf2f4', roofC: '#457b9d', floors: 2, deco: 'ac', door: 'W', face: 'W', doorAt: 0.5 },
  { id: 'labs', name: 'Civil Block', x: 540, y: 2808, w: 397, h: 422, roof: 333, wall: '#d9d6b4', roofC: '#b3ae6f', floors: 2, deco: 'skylight', door: 'W', face: 'W', doorAt: 0.5 },
  { id: 'library', name: 'Central Library', x: 40, y: 2000, w: 310, h: 560, roof: 434, wall: '#f1faee', roofC: '#8d6e63', floors: 2, deco: 'skylight', door: 'S', face: 'S' },
  { id: 'admin', name: 'S&H Block', x: 1050, y: 2882, w: 348, h: 328, roof: 303, wall: '#fefae0', roofC: '#bc6c25', floors: 2, deco: 'tanks', door: 'W', face: 'W', doorAt: 0.5 },
  { id: 'extra1', name: 'R&D cell', x: 1220, y: 1660, w: 290, h: 230, roof: 235, wall: '#f1e3c8', roofC: '#8d6e63', floors: 2, deco: '', door: 'W', face: 'W', doorAt: 0.5 },
  { id: 'extra2', name: 'Exam Branch', x: 1330, y: 2460, w: 240, h: 300, roof: 239, wall: '#f1e3c8', roofC: '#8d6e63', floors: 2, deco: '', door: 'S', face: 'S' },
  { id: 'extra3', name: 'workshop', x: 1450, y: 3030, w: 240, h: 170, roof: 146, wall: '#f1e3c8', roofC: '#8d6e63', floors: 2, deco: '', door: 'S', face: 'S' },
  { id: 'extra4', name: 'workshop 2', x: 1170, y: 2460, w: 140, h: 300, roof: 253, wall: '#f1e3c8', roofC: '#8d6e63', floors: 2, deco: '', face: 'N', door: 'N' },
  { id: 'extra5', name: 'workshop 3', x: 1180, y: 2270, w: 380, h: 110, roof: 328, wall: '#f1e3c8', roofC: '#8d6e63', floors: 2, deco: '', face: 'W', door: 'W', doorAt: 0.5 },
  { id: 'extra6', name: 'Chemistry Lab', x: 1450, y: 2860, w: 240, h: 170, roof: 146, wall: '#f1e3c8', roofC: '#8d6e63', floors: 2, deco: '', door: 'N', face: 'N' },
];

const GATE = { x: 510, y: 0, side: 'S' };   // main gate: side = boundary wall; x is used on top/bottom walls, y on left/right walls

const ROADS = [
  { x: 538, y: 824, w: 118, h: 2548 },   // road A, west carriageway
  { x: 795, y: 824, w: 119, h: 2548 },   // road A, east carriageway (lawn median between the two)
  { x: 1305, y: 517, w: 85, h: 2087 },    // road B
  { x: 0, y: 530, w: 1390, h: 138 },     // top road, upper
  { x: 0, y: 824, w: 1305, h: 139 },     // top road, lower
  { x: 900, y: 2560, w: 659, h: 214 },    // horizontal road to the parking
  { x: 0, y: 3192, w: 1800, h: 108 },    // bottom road in front of the gate
];

const PATHS = [
  { x: 110, y: 2710, w: 200, h: 340 },
];

// Green dividers (lawn medians) between the road carriageways, as drawn in the picture.
// game.js lists them as solids, so nobody can walk or stand in the middle of the road there.
const MEDIANS = [
  { x: 656, y: 963, w: 139, h: 2229 },   // road A: the lawn between its west and east carriageways
  { x: 40, y: 668, w: 616, h: 156 },     // top road: divider west of the road-A junction
  { x: 920, y: 668, w: 368, h: 156 },    // top road: divider between the junction and road B
];

const AREAS = {
  ground: { x: 310, y: 60, w: 1430, h: 1440 },
  court: { x: 1080, y: 1510, w: 320, h: 140 },
  parking: { x: 70, y: 80, w: 207, h: 1390 },
  parking2: { x: 30, y: 1493, w: 470, h: 500 },
  garden: { x: 500, y: 3310, w: 560, h: 290 },
};

const FOUNTAIN = { x: 210, y: 2890 };
const NOTICE   = { x: 350, y: 3230 };

// Open spaces NPCs hang around in.
const ZONES = {
  gate: { x: 395, y: 3550, w: 230, h: 90 },
  quad: { x: 700, y: 3250, w: 210, h: 420 },
  adminFront: { x: 400, y: 2810, w: 100, h: 420 },
  canteenFront: { x: 1160, y: 1940, w: 120, h: 330 },
  blockFront: { x: 450, y: 2130, w: 70, h: 640 },
  labsFront: { x: 1030, y: 3210, w: 150, h: 400 },
  libraryFront: { x: 90, y: 2570, w: 280, h: 120 },
  hostelFront: { x: 1050, y: 3300, w: 100, h: 380 },
  court: { x: 1130, y: 1700, w: 90, h: 220 },
  ground: { x: 380, y: 600, w: 1000, h: 850 },
  audiFront: { x: 420, y: 1635, w: 70, h: 295 },
  garden: { x: 100, y: 1730, w: 260, h: 260 },
};

// ── Items (9-slot backpack) ──────────────────────────────────
const ITEMS = {
  id_card:    { name: 'ID Card',    icon: '🪪', desc: 'Required for the Library, Labs and Exams.' },
  notebook:   { name: 'Notebook',   icon: '📓', desc: 'Take notes in lectures for extra prep.' },
  pen:        { name: 'Pen',        icon: '🖊️', desc: 'You cannot write an exam without one.' },
  calculator: { name: 'Calculator', icon: '🧮', desc: 'Allowed in exams. A small score boost.' },
  lab_coat:   { name: 'Lab Coat',   icon: '🥼', desc: 'Mandatory inside the labs.' },
  sports_kit: { name: 'Sports Kit', icon: '👟', desc: 'Needed for practice and matches.' },
  laptop:     { name: 'Laptop',     icon: '💻', desc: 'For Coding Club projects in the evening.' },
  textbook:   { name: 'Textbook',   icon: '📘', desc: 'Study 25% more effectively in the library.' },
  guitar:     { name: 'Guitar',     icon: '🎸', desc: 'Borrowed from the Music Club. Perform at Fest Night!' },
  usb:        { name: 'Pen Drive',  icon: '💾', desc: 'Someone lost this… it says "CODING CLUB".' },
  snack:      { name: 'Samosa',     icon: '🥟', desc: 'Use (F): +15 energy, +25 hunger.', use: { energy: 15, hunger: 25 }, stack: 5 },
  tea:        { name: 'Chai',       icon: '☕', desc: 'Use (F): +10 energy, +20 water.', use: { energy: 10, water: 20 }, stack: 5 },
  fruit:      { name: 'Fruit Cup',  icon: '🍎', sprite: [0, 0], desc: 'Fresh fruit from the canteen. Use (F): +12 energy, +20 hunger, +20 water.', use: { energy: 12, hunger: 20, water: 20 }, stack: 5 },
  money:      { name: '₹50 note',   icon: '💵', desc: 'Free money!', instant: 50 },
};

// ── Characters ───────────────────────────────────────────────
const CHARS = {
  player:    { sprite: 0, name: 'You', skin: '#c68642', hair: '#1b1b1b', hairStyle: 'short', shirt: '#e63946', pants: '#2b2d42' },
  arjun:     { sprite: 2, name: 'Arjun',         role: 'ECE · Cricket captain',  skin: '#a86b3c', hair: '#111',    hairStyle: 'spiky', shirt: '#1d6fd8', pants: '#333' },
  priya:     { sprite: 4, name: 'Priya',         role: 'CSE · Class topper',     skin: '#d29a6a', hair: '#2a1608', hairStyle: 'long',  shirt: '#7b2cbf', pants: '#3a2c4a' },
  sana:      { sprite: 5, name: 'Sana',          role: 'IT · Coding Club lead',  skin: '#c98b5b', hair: '#140c08', hairStyle: 'bun',   shirt: '#0f9d8a', pants: '#264653', glasses: true },
  ravi:      { sprite: 3, name: 'Ravi',          role: 'Roommate · Foodie',      skin: '#8d5524', hair: '#0d0d0d', hairStyle: 'curly', shirt: '#f4a261', pants: '#4a4e69' },
  prof:      { sprite: 6, name: 'Prof. Lakshmi', role: 'HOD, CSE',               skin: '#b97a4f', hair: '#3b3b3b', hairStyle: 'bun',   shirt: '#c9184a', pants: '#c9184a', glasses: true, saree: true },
  coach:     { sprite: 7, name: 'Coach Mahesh',  role: 'Physical Director',      skin: '#7a4a24', hair: '#222',    hairStyle: 'cap',   shirt: '#2a9d8f', pants: '#1d3557', mustache: true, cap: '#e63946' },
  librarian: { sprite: 1, name: 'Mr. Sharma',    role: 'Librarian',              skin: '#c48a5c', hair: '#aaa',    hairStyle: 'bald',  shirt: '#6c757d', pants: '#343a40', glasses: true },
  anna:      { sprite: 3, name: 'Canteen Anna',  role: 'Runs the canteen',       skin: '#8a5a33', hair: '#111',    hairStyle: 'short', shirt: '#ffffff', pants: '#555', mustache: true, apron: true },
  guard:     { sprite: 2, name: 'Security',      role: 'Main gate',              skin: '#7d4f2a', hair: '#111',    hairStyle: 'cap',   shirt: '#4a5a7a', pants: '#2c3550', mustache: true, cap: '#2c3550' },
};

// Where each named NPC hangs out by hour (null = gone home).
const NPC_SCHED = {
  arjun:     h => h < 8.5 ? 'hostelFront' : h < 12 ? 'blockFront' : h < 13 ? 'canteenFront' : h < 16 ? 'labsFront' : h < 18 ? 'ground' : h < 21 ? 'canteenFront' : 'hostelFront',
  priya:     h => h < 8.5 ? 'libraryFront' : h < 12 ? 'blockFront' : h < 13 ? 'canteenFront' : h < 16 ? 'labsFront' : h < 21 ? 'libraryFront' : null,
  sana:      h => h < 8.5 ? 'quad' : h < 12 ? 'blockFront' : h < 13 ? 'canteenFront' : h < 16 ? 'labsFront' : h < 18 ? 'quad' : h < 21.5 ? 'audiFront' : null,
  ravi:      h => h < 8.5 ? 'hostelFront' : h < 12 ? 'blockFront' : h < 14 ? 'canteenFront' : h < 16 ? 'labsFront' : h < 18 ? 'court' : h < 21 ? 'canteenFront' : 'hostelFront',
  prof:      h => h < 8.5 ? null : h < 12 ? 'blockFront' : h < 16 ? 'labsFront' : h < 18 ? 'adminFront' : null,
  coach:     h => h < 7.5 || h >= 17.5 ? null : 'ground',
  librarian: h => h < 8 || h >= 22 ? null : 'libraryFront',
  anna:      h => h < 7 || h >= 21.5 ? null : 'canteenFront',
  guard:     () => 'gate',
};

// ── Academics ────────────────────────────────────────────────
const SLOT_HOURS = [9, 10, 11, 14];
// Weekday 0 = Mon … 5 = Sat. [subject, building]
const TIMETABLE = [
  [['DBMS', 'blockA'], ['Operating Systems', 'blockB'], ['Probability & Stats', 'blockA'], ['DBMS Lab', 'labs']],
  [['Computer Networks', 'blockB'], ['Algorithms (DAA)', 'blockA'], ['Software Engg', 'blockB'], ['OS Lab', 'labs']],
  [['Operating Systems', 'blockB'], ['DBMS', 'blockA'], ['Algorithms (DAA)', 'blockA'], ['Networks Lab', 'labs']],
  [['Probability & Stats', 'blockA'], ['Computer Networks', 'blockB'], ['Software Engg', 'blockB'], ['DBMS Lab', 'labs']],
  [['Algorithms (DAA)', 'blockA'], ['Operating Systems', 'blockB'], ['DBMS', 'blockA'], ['OS Lab', 'labs']],
  [['Software Engg', 'blockB'], ['Probability & Stats', 'blockA'], ['Computer Networks', 'blockB'], null],
];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Milestone days (no regular classes on exam days).
const EVENTS = {
  4:  { type: 'exam',  name: 'Mid-Term 1',          hour: 10, place: 'blockA', dur: 2 },
  7:  { type: 'match', name: 'Inter-College Cricket Final', hour: 16, place: 'ground' },
  8:  { type: 'exam',  name: 'Mid-Term 2',          hour: 10, place: 'blockA', dur: 2 },
  10: { type: 'fest',  name: 'Fest Night',          hour: 19, place: 'audi' },
  12: { type: 'exam',  name: 'Semester Finals',     hour: 10, place: 'blockA', dur: 3, final: true },
};

const STUDENT_LINES = [
  'Did you finish the DBMS assignment?', 'Canteen biryani today, I heard!', 'Prof. Lakshmi is strict about attendance…',
  'Library closes at 10 PM.', 'Are you coming for the match on Sunday?', 'My lab record is still incomplete 😭',
  'Fest Night is going to be epic!', 'Bro, 75% attendance or detention.', 'Wi-Fi in Block B is the best.',
  'Who took my calculator?!', 'Coding Club meets in the evenings.', 'Mid-terms already?? It\'s only week one!',
];
