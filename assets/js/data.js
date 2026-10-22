window.MAP = window.MAP || {};

MAP.STATUS = {
    free: { label: "Свободно" },
    busy: { label: "Идёт пара" },
    soon: { label: "Скоро начнётся" },
    closed: { label: "Недоступно" }
};

MAP.toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
MAP.nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

MAP.getRoomStatus = (room, now) => {
    if (room.type === "corridor" || room.type === "entrance" || room.type === "stairs" || room.type === "toilet") return room.type;
    if (room.closed) return "closed";
    if (!room.schedule || !room.schedule.length) return "free";
    let res = "free";
    for (const s of room.schedule) {
        const st = MAP.toMin(s.start), en = MAP.toMin(s.end);
        if (now >= st && now < en) return "busy";
        if (st > now && st - now <= 15) res = "soon";
    }
    return res;
};

const GEO = { FW: 1000, FH: 720 };

const POLYGON = {
    L: "0,0 1000,0 1000,720 680,720 680,360 0,360",
    H: "0,0 1000,0 1000,720 0,720"
};

function centroidFromPoints(str) {
    const pts = str.trim().split(/\s+/).map(p => p.split(",").map(Number));
    let A = 0, Cx = 0, Cy = 0; const [x0, y0] = pts[0];
    for (let i = 1; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        const a = ((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) / 2;
        A += a; Cx += a * (x0 + x1 + x2) / 3; Cy += a * (y0 + y1 + y2) / 3;
    }
    if (A === 0) return { x: GEO.FW / 2, y: GEO.FH / 2 };
    return { x: Cx / A, y: Cy / A };
}

const PAIRS = ["08:30-10:00", "10:15-11:45", "12:30-14:00", "14:15-15:45", "16:00-17:30"];
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function mockSchedule(id) {
    const h = hash(id), n = h % 3, out = [];
    for (let i = 0; i < n; i++) {
        const p = PAIRS[(h >> (i * 3)) % PAIRS.length].split("-");
        out.push({ start: p[0], end: p[1], subject: "Занятие", teacher: "—" });
    }
    return out;
}

const R = Math.round;
function room(id, x, y, w, h) { return { id, name: "", type: "classroom", x: R(x), y: R(y), w: R(w), h: R(h), capacity: null, schedule: mockSchedule(id) }; }
function corr(x, y, w, h) { return { id: "corridor", name: "", type: "corridor", x: R(x), y: R(y), w: R(w), h: R(h), schedule: [] }; }
function stair(x, y, w, h, name) { return { id: "stair", name: name || "Лестница", type: "stairs", x: R(x), y: R(y), w: R(w), h: R(h), schedule: [] }; }
function stairExit(x, y, w, h, name) { return { ...stair(x, y, w, h, name), exitArrow: true }; }
function toilet(x, y, w, h, name) { return { id: "wc", name: name || "Туалет", type: "toilet", x: R(x), y: R(y), w: R(w), h: R(h), schedule: [] }; }
function exit(x, y, w, h, label) { return { id: "exit", name: label || "Выход", type: "entrance", x: R(x), y: R(y), w: R(w), h: R(h), schedule: [] }; }

// ===== 1 ЭТАЖ =====
const FLOOR1 = {
    level: 1, name: "1 этаж",
    polygon: "0,0 1000,0 1000,720 680,720 680,360 0,360",
    rooms: [
        room("6", 0, 0, 110, 150),
        room("8", 110, 0, 140, 150),
        room("10", 250, 0, 139, 150),
        stair(389, 0, 90, 150, "Лестница 2-й этаж"),
        room("14", 479, 0, 151, 150),
        room("15", 630, 0, 110, 150),
        exit(740, 0, 130, 150, "Выход ↑"),
        room("15а", 870, 0, 130, 150),

        corr(0, 150, 870, 70),
        stair(870, 150, 130, 70, "Лестница 2-й этаж"),

        room("5", 0, 220, 130, 140),
        room("7", 130, 220, 130, 140),
        room("9", 260, 220, 130, 140),
        toilet(390, 220, 88, 140, "Туалет М"),
        room("12", 478, 220, 84, 140),
        room("13", 562, 220, 118, 140),

        room("18", 680, 220, 130, 140),
        room("20", 680, 360, 130, 140),
        room("22", 680, 500, 130, 140),
        corr(810, 220, 60, 500),
        room("16", 870, 220, 130, 85),
        room("17", 870, 305, 130, 85),
        room("19", 870, 390, 130, 100),
        room("21", 870, 490, 130, 115),
        room("23", 870, 605, 130, 115),
        stairExit(680, 640, 130, 80, "Лестница подвал/2-й этаж")
    ]
};

// ===== 2 ЭТАЖ =====
const FLOOR2 = {
    level: 2, name: "2 этаж",
    polygon: "0,0 1000,0 1000,720 680,720 680,360 0,360",
    rooms: [
        room("41", 0, 0, 130, 150),
        room("40", 130, 0, 130, 150),
        room("39", 260, 0, 129, 150),
        stair(389, 0, 90, 150, "Лестница 1-й этаж"),
        room("35", 479, 0, 150, 150),
        room("33", 629, 0, 130, 150),
        room("Замдир", 759, 0, 111, 150),
        room("33а", 870, 0, 130, 150),

        corr(0, 150, 870, 90),
        stair(870, 150, 130, 90, "Лестница 1-й/3-й Этаж"),

        room("40", 0, 240, 130, 120),
        room("41", 130, 240, 130, 120),
        room("37", 260, 240, 132, 120),
        toilet(392, 240, 88, 120, "Туалет Ж"),
        room("36", 480, 240, 100, 120),
        room("34", 580, 240, 100, 120),

        room("32", 680, 240, 130, 100),
        room("30", 680, 340, 130, 100),
        room("28", 680, 440, 130, 100),
        room("26", 680, 540, 130, 100),
        stair(680, 640, 130, 80, "Лестница 1-й/3-й Этаж"),   // стрелка выхода убрана

        corr(810, 240, 60, 480),
        room("31", 870, 240, 130, 96),
        room("29", 870, 336, 130, 96),
        room("27", 870, 432, 130, 96),
        room("25", 870, 528, 130, 96),
        room("23", 870, 624, 130, 96)
    ]
};

// ===== 3 ЭТАЖ (твоя финальная сетка + имена лестниц) =====
const FLOOR3 = {
    level: 3, name: "3 этаж",
    polygon: "0,0 1000,0 1000,720 500,720 500,345 0,345",
    rooms: [
        room("58б", 0, 0, 500, 150),
        room("58", 0, 150, 250, 195),
        room("58", 250, 150, 150, 55),
        corr(400, 150, 100, 55),
        room("58а", 250, 205, 250, 140),

        room("57", 500, 0, 130, 150),
        room("55", 750, 0, 250, 150),
        corr(500, 150, 250, 90),
        corr(630, 0, 120, 150),
        stair(750, 150, 250, 90, "Лестница 2-й Этаж"),

        room("59", 500, 240, 130, 140),
        room("61", 500, 380, 130, 100),
        room("63", 500, 480, 130, 100),
        room("65", 500, 580, 130, 100),
        stairExit(500, 680, 130, 40, "Лестница 2-й Этаж"),

        corr(630, 240, 120, 480),
        room("60", 750, 240, 250, 96),
        room("62", 750, 336, 250, 96),
        room("64", 750, 432, 250, 96),
        room("64а", 750, 528, 250, 96),
        room("64б", 750, 624, 250, 96)
    ]
};

// ===== generic для подвала (без плана — оставляем как есть) =====
function parseTok(tok) {
    if (tok === "STAIR" || tok.startsWith("STAIR:")) { const w = tok.includes(":") ? parseFloat(tok.split(":")[1]) : 1; return { stairs: true, w, h: w }; }
    const [id, w] = tok.split(":"); const n = w ? parseFloat(w) : 1; return { id, w: n, h: n };
}
function layoutRow(toks, x0, totalW, y, h) {
    const it = toks.map(parseTok); const s = it.reduce((a, i) => a + i.w, 0) || 1; let cx = x0; const o = [];
    it.forEach(i => { const w = totalW * i.w / s; o.push(i.stairs ? stair(cx, y, w, h) : room(i.id, cx, y, w, h)); cx += w; }); return o;
}
function buildBasement(f) {
    const G = GEO, rooms = []; const TOP = 300, CORR = 120, botH = G.FH - TOP - CORR;
    rooms.push(...layoutRow(f.top, 0, G.FW, 0, TOP));
    rooms.push(corr(0, TOP, G.FW, CORR));
    rooms.push(...layoutRow(f.bottom, 0, G.FW, TOP + CORR, botH));
    return rooms;
}
const BASEMENT_CFG = { level: 0, name: "Подвал", shape: "H", polygon: POLYGON.H, top: ["01", "02", "03"], bottom: ["04", "05", "06"] };

// ПОРЯДОК КНОПОК: подвал первым, затем 1,2,3
MAP.DATA = {
    buildingName: "Главный корпус",
    geo: GEO,
    polygon: POLYGON,
    floors: [
        {
            level: BASEMENT_CFG.level, name: BASEMENT_CFG.name, cfg: { shape: BASEMENT_CFG.shape }, polygon: BASEMENT_CFG.polygon,
            rooms: buildBasement(BASEMENT_CFG), center: centroidFromPoints(BASEMENT_CFG.polygon)
        },
        { ...FLOOR1, cfg: { shape: "custom" }, center: centroidFromPoints(FLOOR1.polygon) },
        { ...FLOOR2, cfg: { shape: "custom" }, center: centroidFromPoints(FLOOR2.polygon) },
        { ...FLOOR3, cfg: { shape: "custom" }, center: centroidFromPoints(FLOOR3.polygon) }
    ]
};

MAP.state = {
    currentFloor: 1,                                   // старт с 1 этажа
    view: "top",
    flags: { walls: true, partitions: true, labels: true, schedule: true, neon: true },
    roomEls: {},
    labels: []                                         // кэш подписей для контр-поворота
};