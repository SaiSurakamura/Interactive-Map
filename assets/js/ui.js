MAP.ui = {
    init() {
        MAP.scene.init();
        MAP.drag.init();
        MAP.controls.bind();                                  // восстанавливает настройки из localStorage
        MAP.scene.renderFloor(MAP.state.currentFloor);        // старт сразу с этажа, без стопки
        this.startClock();
    },

    startClock() {
        const clockEl = document.getElementById("clock");
        const tick = () => { const d = new Date(); if (clockEl) clockEl.textContent = d.toLocaleTimeString("ru-RU"); };
        tick();
        setInterval(tick, 1000);
        setInterval(() => MAP.scene.refreshStatuses(), 30000);
    },

    showInfo(room) {
        const panel = document.getElementById("infoPanel");
        const body = document.getElementById("infoBody");
        if (!panel || !body) return;
        const now = MAP.nowMin();
        const status = MAP.getRoomStatus(room, now);
        const st = MAP.STATUS[status] || MAP.STATUS.free;

        let schedHtml;
        if (room.schedule && room.schedule.length) {
            const items = room.schedule.map(s => {
                const stn = MAP.toMin(s.start), en = MAP.toMin(s.end);
                let cls = "";
                if (now >= stn && now < en) cls = "now";
                else if (stn > now && stn - now <= 15) cls = "soon";
                return `<div class="sched-item ${cls}">
          <div><div class="subj">${s.subject}</div><div class="teacher">${s.teacher}</div></div>
          <div class="time">${s.start}–${s.end}</div>
        </div>`;
            }).join("");
            schedHtml = `<div class="info-schedule"><h5>Расписание на сегодня</h5>${items}</div>`;
        } else {
            schedHtml = `<div class="info-schedule"><h5>Расписание на сегодня</h5><div class="info-empty">Свободно весь день</div></div>`;
        }

        const typeNames = {
            classroom: "Учебная аудитория", lab: "Лаборатория / практикум",
            lecture: "Лекторий", facility: "Обслуживающее помещение",
            service: "Служебное помещение", corridor: "Коридор"
        };

        body.innerHTML = `
      <div class="info-head">
        <span class="info-id">${room.id}</span>
        <span class="info-name">${room.name || ""}</span>
      </div>
      <span class="status-badge ${status}">● ${st.label}</span>
      <div class="info-grid">
        <div class="info-cell"><div class="k">Тип</div><div class="v">${typeNames[room.type] || room.type}</div></div>
        <div class="info-cell"><div class="k">Вместимость</div><div class="v">${room.capacity ? room.capacity + " мест" : "—"}</div></div>
      </div>
      ${schedHtml}
    `;
        panel.classList.add("open");
    },

    hideInfo() {
        const p = document.getElementById("infoPanel");
        if (p) p.classList.remove("open");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    MAP.ui.init();
    const closeBtn = document.getElementById("closeInfo");
    if (closeBtn) closeBtn.addEventListener("click", () => MAP.ui.hideInfo());
});