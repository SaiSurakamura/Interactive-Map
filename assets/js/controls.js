MAP.controls = {
    $(id) { return document.getElementById(id); },

    LS: "cmap_prefs",
    loadPrefs() {
        let p = {};
        try { p = JSON.parse(localStorage.getItem(this.LS) || "{}"); } catch (e) { p = {}; }
        if (p.flags) MAP.state.flags = { ...MAP.state.flags, ...p.flags };
        if (p.view) MAP.state.view = p.view;
        if (p.invert != null && MAP.drag) MAP.drag.invert = !!p.invert;
        if (p.lastFloor != null) MAP.state.currentFloor = p.lastFloor;
        return p;
    },
    savePrefs() {
        const p = {
            flags: MAP.state.flags, view: MAP.state.view,
            invert: !!(MAP.drag && MAP.drag.invert), lastFloor: MAP.state.currentFloor
        };
        try { localStorage.setItem(this.LS, JSON.stringify(p)); } catch (e) { }
    },
    syncUIFromState() {
        const f = MAP.state.flags;

        const setChk = (id, v) => {
            const el = this.$(id);
            if (el) el.checked = v;
        };

        setChk("toggleWalls", f.walls);
        setChk("togglePartitions", f.partitions);
        setChk("toggleLabels", f.labels);
        setChk("toggleSchedule", f.schedule);
        setChk("toggleNeon", f.neon);
        setChk("toggleInvert", !!(MAP.drag && MAP.drag.invert));

        const vb = this.$("viewButtons");
        if (vb) {
            vb.querySelectorAll("button[data-view]").forEach(b =>
                b.classList.toggle("active", b.dataset.view === MAP.state.view)
            );
        }

        const slider = this.$("zoomSlider");
        if (slider && MAP.viewport) {
            slider.value = String(Math.round(MAP.viewport.zoom * 100));
        }
    },

    bind() {
        this.loadPrefs();
        this.safe(this.buildFloorButtons);
        this.safe(this.bindToggles);
        this.safe(this.bindViewButtons);
        this.safe(this.bindZoom);
        this.safe(this.bindSearch);
        this.safe(this.bindRefresh);
        this.safe(this.bindMobileMenu);
        this.safe(this.bindInvert);
        this.safe(this.bindNeon);
        this.syncUIFromState();
    },
    safe(fn) { try { fn.call(this); } catch (e) { console.warn("MAP.controls: шаг пропущен →", fn.name, e); } },

    selectFloor(level) {
        MAP.scene.renderFloor(level);
        MAP.ui.hideInfo();
        this.savePrefs();
        const wrap = this.$("floorButtons");
        if (wrap) wrap.querySelectorAll("button").forEach(b =>
            b.classList.toggle("active", Number(b.dataset.level) === level));
    },

    buildFloorButtons() {
        const wrap = this.$("floorButtons");
        if (!wrap) return;
        wrap.innerHTML = MAP.DATA.floors.map(f =>
            `<button data-level="${f.level}" class="${f.level === MAP.state.currentFloor ? "active" : ""}">${f.level === 0 ? "П" : f.level}</button>`
        ).join("");
        wrap.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-level]");
            if (btn) this.selectFloor(Number(btn.dataset.level));
        });
    },

    bindToggles() {
        const map = { toggleWalls: "walls", togglePartitions: "partitions", toggleLabels: "labels", toggleSchedule: "schedule" };
        Object.entries(map).forEach(([id, flag]) => {
            const el = this.$(id);
            if (!el) { console.warn("MAP.controls: нет элемента", id); return; }
            el.addEventListener("change", () => { MAP.state.flags[flag] = el.checked; MAP.scene.applyFlags(); this.savePrefs(); });
        });
    },

    bindViewButtons() {
        const wrap = this.$("viewButtons");
        if (!wrap) return;
        wrap.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-view]");
            if (btn) this.activateView(btn);
        });
    },
    activateView(btn) {
        btn.parentElement.querySelectorAll("button[data-view]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        if (MAP.drag) { MAP.drag.rotX = 55; MAP.drag.rotZ = -32; }
        if (MAP.scene && MAP.scene.applyView) MAP.scene.applyView(btn.dataset.view);
        this.savePrefs();
    },

    bindZoom() {
        const click = (id, fn) => {
            const el = this.$(id);
            if (el) el.addEventListener("click", fn);
        };

        click("zoomIn", () => MAP.viewport.zoomAt(MAP.viewport.zoom * 1.25));
        click("zoomOut", () => MAP.viewport.zoomAt(MAP.viewport.zoom / 1.25));
        click("zoomReset", () => MAP.viewport.reset());

        click("zoomInMobile", () => MAP.viewport.zoomAt(MAP.viewport.zoom * 1.25));
        click("zoomOutMobile", () => MAP.viewport.zoomAt(MAP.viewport.zoom / 1.25));

        const slider = this.$("zoomSlider");

        if (slider) {
            slider.addEventListener("input", () => {
                const z = Number(slider.value) / 100;
                const clamped = Math.max(MAP.viewport.MIN, Math.min(MAP.viewport.MAX, z));
                MAP.viewport.zoomAt(clamped);
            });
        }
    },

    bindInvert() {
        const el = this.$("toggleInvert");
        if (!el) return;
        el.addEventListener("change", () => { if (MAP.drag) MAP.drag.invert = el.checked; this.savePrefs(); });
    },

    bindNeon() {
        const el = this.$("toggleNeon");
        if (!el) return;
        el.addEventListener("change", () => { MAP.state.flags.neon = el.checked; MAP.scene.applyFlags(); this.savePrefs(); });
    },

    bindSearch() {
        const input = this.$("searchInput"), btn = this.$("searchBtn");
        if (!input || !btn) return;
        const go = () => {
            const q = input.value.trim().toLowerCase();
            if (!q) return;
            const cur = MAP.DATA.floors.find(f => f.level === MAP.state.currentFloor);
            const hit = cur.rooms.find(r => r.type === "classroom" && (r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)));
            if (hit) { MAP.scene.highlightRoom(hit.id); MAP.ui.showInfo(hit); return; }
            const other = MAP.DATA.floors.flatMap(f => f.rooms.map(r => ({ r, level: f.level })))
                .find(({ r }) => r.type === "classroom" && (r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)));
            if (other) {
                this.selectFloor(other.level);
                setTimeout(() => { MAP.scene.highlightRoom(other.r.id); MAP.ui.showInfo(other.r); }, 60);
            } else alert("Аудитория не найдена");
        };
        btn.addEventListener("click", go);
        input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    },

    bindRefresh() {
        const btn = this.$("refreshBtn");
        if (btn) btn.addEventListener("click", () => MAP.scene.refreshStatuses());
    },

    bindMobileMenu() {
        const sidebar = this.$("sidebar"), backdrop = this.$("menuBackdrop"), burger = this.$("burgerBtn");
        if (!sidebar || !backdrop || !burger) return;
        const open = v => { sidebar.classList.toggle("open", v); backdrop.classList.toggle("show", v); };
        burger.addEventListener("click", () => open(!sidebar.classList.contains("open")));
        backdrop.addEventListener("click", () => open(false));
    }
};