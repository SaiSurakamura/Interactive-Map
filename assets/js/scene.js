MAP.scene = {
    floorEl: null,
    stageEl: null,

    init() {
        this.floorEl = document.getElementById("floor");
        this.stageEl = document.getElementById("mapStage");
        MAP.labels.init();
        window.addEventListener("resize", () => MAP.viewport.recomputeBase());
        MAP.viewport.recomputeBase();
    },

    buildShell(container, polyPoints) {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", `0 0 ${MAP.DATA.geo.FW} ${MAP.DATA.geo.FH}`);
        svg.setAttribute("preserveAspectRatio", "none");
        svg.innerHTML = `
      <polygon class="floor-fill" fill="rgba(10,15,30,0.55)" points="${polyPoints}"/>
      <polygon class="wall-line"  points="${polyPoints}"/>
    `;
        container.appendChild(svg);
    },

    // Комнаты — в .floor (трансформируются). Подписи — в ЭКРАННЫЙ оверлей
    // (нативный текст => без мыла, без переворота). pair хранит базовый
    // размер шрифта, чтобы update() масштабировал его тем же s, что сцена.
    buildFloorInto(container, level, interactive) {
        const data = MAP.DATA.floors.find(f => f.level === level);
        if (!data) return;
        container.innerHTML = "";
        MAP.labels.clear();
        this.buildShell(container, data.polygon || MAP.DATA.polygon[data.cfg.shape]);

        const roomEls = {};
        data.rooms.forEach((room, i) => {
            const el = document.createElement("div");
            const cls = ["room"];
            if (room.type === "corridor") cls.push("corridor");
            if (room.type === "entrance") cls.push("entrance");
            if (room.type === "stairs") cls.push("stairs");
            if (room.type === "toilet") cls.push("toilet");
            el.className = cls.join(" ");
            el.style.left = room.x + "px"; el.style.top = room.y + "px";
            el.style.width = room.w + "px"; el.style.height = room.h + "px";
            el.dataset.id = room.id;

            if (interactive && room.type === "classroom") {
                el.addEventListener("click", () => { if (!MAP.viewport.moved) MAP.ui.showInfo(room); });
            }
            container.appendChild(el);
            roomEls[i] = el;

            // подпись в оверлей; класс = тип комнаты (для цвета stairs/toilet/entrance)
            const label = document.createElement("div");
            label.className = "room-label lbl-" + room.type;
            label.textContent = room.name ? room.name : room.id;
            MAP.labels.overlayEl.appendChild(label);
            MAP.labels.pairs.push({ roomEl: el, labelEl: label, basePx: (room.type === "classroom" || room.type === "corridor") ? 13 : 12 });
        });
        return roomEls;
    },

    renderFloor(level) {
        const data = MAP.DATA.floors.find(f => f.level === level);
        if (!data) return;
        MAP.state.currentFloor = level;
        MAP.state.roomEls = this.buildFloorInto(this.floorEl, level, true);

        MAP.viewport.reset();
        this.refreshStatuses();
        this.applyFlags();
        this.applyView(MAP.state.view);

        document.getElementById("floorName").textContent = data.name;
        document.getElementById("buildingName").textContent = MAP.DATA.buildingName;
    },

    refreshStatuses() {
        const now = MAP.nowMin();
        const data = MAP.DATA.floors.find(f => f.level === MAP.state.currentFloor);
        if (!data) return;
        data.rooms.forEach((room, i) => {
            if (room.type !== "classroom") return;
            const el = MAP.state.roomEls[i];
            if (!el) return;
            const st = MAP.getRoomStatus(room, now);
            el.classList.remove("status-free", "status-busy", "status-soon", "status-closed");
            el.classList.add("status-" + st);
        });
    },

    applyFlags() {
        const f = MAP.state.flags;
        this.floorEl.classList.toggle("no-walls", !f.walls);
        this.floorEl.classList.toggle("no-partitions", !f.partitions);
        this.floorEl.classList.toggle("no-schedule", !f.schedule);
        document.body.classList.toggle("no-neon", !f.neon);
        MAP.labels.setVisible(f.labels);   // тумблер "Подписи комнат"
    },

    applyView(mode) {
        MAP.state.view = mode;
        if (mode === "free") { MAP.drag.rotX = 55; MAP.drag.rotZ = -32; }
        const hint = document.getElementById("viewHint");
        if (hint) hint.style.display = (mode === "free") ? "block" : "none";
        MAP.viewport.applyNow();
    },

    highlightRoom(id) {
        const data = MAP.DATA.floors.find(f => f.level === MAP.state.currentFloor);
        if (!data) return;
        const i = data.rooms.findIndex(r => r.id === id);
        const el = i >= 0 ? MAP.state.roomEls[i] : null;
        if (!el) return;
        el.classList.remove("found"); void el.offsetWidth; el.classList.add("found");
        setTimeout(() => el.classList.remove("found"), 3200);
    }
};

// ============================================================
//  ЭКРАННЫЙ ОВЕРЛЕЙ ПОДПИСЕЙ. Позиции = getBoundingClientRect
//  комнат (реальное экранное положение после всех трансформов),
//  поэтому текст точный и в "Сверху", и в изометрии, и в свободном.
//  font-size/width масштабируются тем же s, что сцена => прежние
//  пропорции, но нативный растер (без мыла от layer-scale).
// ============================================================
MAP.labels = {
    overlayEl: null,
    pairs: [],

    init() { this.overlayEl = document.getElementById("labelsOverlay"); },
    clear() { if (this.overlayEl) this.overlayEl.innerHTML = ""; this.pairs = []; },
    setVisible(v) { if (this.overlayEl) this.overlayEl.style.display = v ? "" : "none"; },

    update() {
        if (!this.overlayEl || this.overlayEl.style.display === "none") return;
        const sr = MAP.scene.stageEl.getBoundingClientRect();
        const s = MAP.viewport.base * MAP.viewport.zoom;
        const pairs = this.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const p = pairs[i];
            const r = p.roomEl.getBoundingClientRect();
            const lb = p.labelEl;
            lb.style.left = (r.left - sr.left + r.width / 2) + "px";
            lb.style.top = (r.top - sr.top + r.height / 2) + "px";
            lb.style.width = Math.max(18, r.width) + "px";        // перенос как раньше
            lb.style.fontSize = (p.basePx * s) + "px";            // дробный, но нативный растер
        }
    }
};

// ============================================================
//  VIEWPORT. apply() = rAF-батчинг (одно применение/кадр),
//  applyNow() = тело (трансформ + обновление подписей). Горячие
//  пути (drag/wheel) зовут apply(); редкие/немедленные зовут applyNow().
// ============================================================
MAP.viewport = {
    PAD: 0.74, base: 1, zoom: 1, tx: 0, ty: 0, MIN: 0.5, MAX: 5, keys: new Set(), raf: 0, moved: false,
    _pending: false, _raf: 0,

    apply() {                       // планировщик: не чаще одного раза за кадр
        this._pending = true;
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
            this._raf = 0;
            if (this._pending) { this._pending = false; this.applyNow(); }
        });
    },

    applyNow() {
        const s = this.base * this.zoom; let rx = 0, rz = 0;
        if (MAP.state.view === "iso") { rx = 55; rz = -32; }
        if (MAP.state.view === "free") { rx = MAP.drag.rotX; rz = MAP.drag.rotZ; }
        const el = MAP.scene.floorEl; if (!el) return;
        el.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${s}) rotateX(${rx}deg) rotateZ(${rz}deg)`;
        MAP.labels.update();          // контр-поворот НЕ нужен: оверлей экранно-горизонтален
        const lbl = document.getElementById("zoomLabel"); if (lbl) lbl.textContent = Math.round(this.zoom * 100) + "%";
    },

    slack() {
        const st = MAP.scene.stageEl; if (!st) return { sx: 0, sy: 0 }; const g = MAP.DATA.geo, s = this.base * this.zoom;
        return { sx: Math.max(0, (st.clientWidth - g.FW * s) / 2), sy: Math.max(0, (st.clientHeight - g.FH * s) / 2) };
    },

    applyCenter() {
        const g = MAP.DATA.geo; if (MAP.state.view !== "top") { this.tx = 0; this.ty = 0; return; }
        const f = MAP.DATA.floors.find(fl => fl.level === MAP.state.currentFloor);
        const c = (f && f.center) ? f.center : { x: g.FW / 2, y: g.FH / 2 }; const s = this.base * this.zoom;
        const dtx = -(c.x - g.FW / 2) * s, dty = -(c.y - g.FH / 2) * s; const { sx, sy } = this.slack();
        this.tx = Math.max(-sx, Math.min(sx, dtx)); this.ty = Math.max(-sy, Math.min(sy, dty));
    },

    recomputeBase() {
        const st = MAP.scene.stageEl; if (!st) return; const g = MAP.DATA.geo;
        this.base = Math.max(0.2, Math.min(st.clientWidth / g.FW, st.clientHeight / g.FH)) * this.PAD; this.applyCenter(); this.applyNow();
    },
    reset() { this.zoom = 1; this.applyCenter(); this.applyNow(); },
    zoomAt(nz, qx = 0, qy = 0) {
        const z = Math.max(this.MIN, Math.min(this.MAX, nz)); const r = z / this.zoom;
        this.tx = qx - r * (qx - this.tx); this.ty = qy - r * (qy - this.ty); this.zoom = z; this.apply();
    },
    toCenter(cx, cy) { const r = MAP.scene.stageEl.getBoundingClientRect(); return { x: cx - r.left - r.width / 2, y: cy - r.top - r.height / 2 }; },
    bindWheel() {
        MAP.scene.stageEl.addEventListener("wheel", e => {
            e.preventDefault();
            const f = e.deltaY < 0 ? 1.12 : 1 / 1.12; const q = this.toCenter(e.clientX, e.clientY); this.zoomAt(this.zoom * f, q.x, q.y);
        }, { passive: false });
    },

    KEYMAP: { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [1, 0], ArrowLeft: [1, 0], KeyD: [-1, 0], ArrowRight: [-1, 0] },
    bindKeys() {
        window.addEventListener("keydown", e => { const v = this.KEYMAP[e.code]; if (!v) return; e.preventDefault(); this.keys.add(e.code); this.startLoop(); });
        window.addEventListener("keyup", e => { if (this.KEYMAP[e.code]) this.keys.delete(e.code); });
        window.addEventListener("blur", () => this.keys.clear());
    },
    startLoop() {
        if (this.raf) return; const step = () => {
            if (!this.keys.size) { this.raf = 0; return; }
            const sp = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) ? 24 : 10; let dx = 0, dy = 0;
            this.keys.forEach(c => { const v = this.KEYMAP[c]; if (v) { dx += v[0]; dy += v[1]; } }); const l = Math.hypot(dx, dy) || 1;
            this.tx += (dx / l) * sp; this.ty += (dy / l) * sp; this.applyNow(); this.raf = requestAnimationFrame(step);
        }; this.raf = requestAnimationFrame(step);
    }
};

// ===== УКАЗАТЕЛЬ: ЛКМ = rotate в free / pan иначе; ПКМ = pan; pinch = zoom =====
MAP.drag = {
    SENS_Z: 0.4, SENS_X: 0.3, TILT_MIN: 10, TILT_MAX: 80,
    mode: null, startX: 0, startY: 0, rotX: 55, rotZ: -32, startRotX: 55, startRotZ: -32, invert: false,
    panTx0: 0, panTy0: 0, pinchDist0: 0, pinchZoom0: 1, pinchQ: { x: 0, y: 0 },

    init() {
        const stage = document.getElementById("mapStage");
        stage.addEventListener("mousedown", e => this.down(e.clientX, e.clientY, e.button));
        stage.addEventListener("contextmenu", e => e.preventDefault());
        stage.addEventListener("touchstart", e => {
            if (e.touches.length === 2) this.pinchStart(e.touches[0], e.touches[1]);
            else if (e.touches.length === 1) this.down(e.touches[0].clientX, e.touches[0].clientY, 0);
        }, { passive: true });
        window.addEventListener("mousemove", e => this.move(e.clientX, e.clientY));
        window.addEventListener("touchmove", e => {
            if (this.mode === "pinch" && e.touches.length === 2) this.pinchMove(e.touches[0], e.touches[1]);
            else if (e.touches.length === 1) this.move(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        window.addEventListener("mouseup", () => this.up()); window.addEventListener("touchend", () => this.up()); window.addEventListener("touchcancel", () => this.up());
        MAP.viewport.bindWheel(); MAP.viewport.bindKeys();
    },

    down(x, y, btn) {
        MAP.viewport.moved = false; this.startX = x; this.startY = y;
        if (btn === 2) { this.mode = "pan"; this.panTx0 = MAP.viewport.tx; this.panTy0 = MAP.viewport.ty; }
        else if (MAP.state.view === "free") { this.mode = "rotate"; this.startRotX = this.rotX; this.startRotZ = this.rotZ; }
        else { this.mode = "pan"; this.panTx0 = MAP.viewport.tx; this.panTy0 = MAP.viewport.ty; }
        document.getElementById("mapStage").style.cursor = "grabbing";
    },

    move(x, y) {
        if (!this.mode || this.mode === "pinch") return; const dx = x - this.startX, dy = y - this.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) MAP.viewport.moved = true;
        if (this.mode === "rotate") {
            const s = this.invert ? -1 : 1;
            this.rotZ = this.startRotZ - (dx * s) * this.SENS_Z;
            this.rotX = Math.max(this.TILT_MIN, Math.min(this.TILT_MAX, this.startRotX - (dy * s) * this.SENS_X)); MAP.viewport.apply();
        }
        else if (this.mode === "pan") { MAP.viewport.tx = this.panTx0 + dx; MAP.viewport.ty = this.panTy0 + dy; MAP.viewport.apply(); }
    },

    up() { this.mode = null; const st = document.getElementById("mapStage"); if (st) st.style.cursor = ""; },

    pinchStart(t1, t2) {
        this.mode = "pinch"; MAP.viewport.moved = true; this.pinchDist0 = this.dist(t1, t2) || 1; this.pinchZoom0 = MAP.viewport.zoom;
        this.pinchQ = MAP.viewport.toCenter((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
    },
    pinchMove(t1, t2) { MAP.viewport.zoomAt(this.pinchZoom0 * (this.dist(t1, t2) / this.pinchDist0), this.pinchQ.x, this.pinchQ.y); },
    dist(t1, t2) { return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); }
};