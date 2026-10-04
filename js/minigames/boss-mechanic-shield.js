const BOSS_SHIELD_APPEAR_TIME = 450;    // ms antes de que aparezca la barra
const BOSS_SHIELD_RESULT_TIME = 1100;   // ms que se ve el resultado
const BOSS_SHIELD_RETRY_ON_RED = true;  // true: en rojo el escudo aguanta y se reintenta
const BOSS_SHIELD_CURVE = 0.8;          // <1: sube más rápido al principio

// Valores a 10 HP (easy) y a 1 HP (hard)
const BOSS_SHIELD_LEVELS = {
    green:  { easy: 0.273, hard: 0.08 },  // fracción de la barra que es verde
    travel: { easy: 1500,  hard: 900 },   // ms que tarda el indicador en cruzar
    warp:   { easy: 0,     hard: 0.35 },  // irregularidad de la velocidad (0 = constante)
    limit:  { easy: 12000, hard: 3200 }   // ms para romper antes de que el escudo aguante
};

function getBossShieldParams(difficulty) {
    function level(key) {
        const entry = BOSS_SHIELD_LEVELS[key];
        return bossLerp(entry.easy, entry.hard, difficulty, BOSS_SHIELD_CURVE);
    }

    const green = level("green");
    const side = (1 - green) / 4;   // rojo y amarillo del mismo tamaño, como en la barra original

    return {
        zones: [
            { type: "red", size: side },
            { type: "yellow", size: side },
            { type: "green", size: green },
            { type: "yellow", size: side },
            { type: "red", size: side }
        ],
        travelTime: level("travel"),
        warp: level("warp"),
        limit: level("limit")
    };
}

function getBossShieldZone(zones, position) {
    let total = 0;

    zones.forEach(function(zone) {
        total += zone.size;
    });

    let accumulated = 0;

    for (const zone of zones) {
        accumulated += zone.size / total;

        if (position <= accumulated) {
            return zone.type;
        }
    }

    return zones[zones.length - 1].type;
}

function createBossShieldMechanic() {
    let ctx = null;
    let run = 0;        // invalida callbacks al cancelar o terminar
    let attempt = 0;    // invalida bucles de intentos anteriores
    let resolved = true;

    let params = getBossShieldParams(0);

    let layer = null;
    let shieldImage = null;
    let timing = null;
    let indicator = null;
    let timerEl = null;
    let button = null;

    let startTime = 0;
    let phase = 0;

    function later(ms, callback) {
        const myRun = run;

        setTimeout(function() {
            if (myRun === run) {
                callback();
            }
        }, ms);
    }

    function getPosition(now) {
        // Ida y vuelta continua; con "warp" la velocidad cambia durante el recorrido
        const tau = (now - startTime) / params.travelTime + phase;
        const warped = tau - (params.warp / (2 * Math.PI)) * Math.sin(2 * Math.PI * tau);
        const t = ((warped % 2) + 2) % 2;

        return t <= 1 ? t : 2 - t;
    }

    function setIndicator(position) {
        if (indicator) {
            indicator.style.left = (position * 100) + "%";
        }
    }

    function avoidList() {
        return ctx.avoid.concat([timing, timerEl]);
    }

    function onResize() {
        if (button && timing && ctx && !resolved) {
            placeBossButton(button, ctx.arena, avoidList());
        }
    }

    function startTimer() {
        const span = timerEl.firstElementChild;

        span.style.transition = "none";
        span.style.width = "100%";
        void span.offsetWidth;
        span.style.transition = "width " + params.limit + "ms linear";
        span.style.width = "0%";
    }

    function freezeTimer() {
        if (!timerEl) {
            return;
        }

        const span = timerEl.firstElementChild;
        const current = getComputedStyle(span).width;

        span.style.transition = "none";
        span.style.width = current;
    }

    function removeUi() {
        window.removeEventListener("resize", onResize);

        [layer, timing, button].forEach(function(element) {
            if (element) {
                element.remove();
            }
        });

        layer = null;
        shieldImage = null;
        timing = null;
        indicator = null;
        timerEl = null;
        button = null;
    }

    /* ---------- Inicio ---------- */

    function start(context) {
        ctx = context;
        run++;
        attempt = 0;
        resolved = true;

        // Todo se calcula con el HP que le queda al jefe
        params = getBossShieldParams(ctx.difficulty);

        ctx.setHint("¡Tiene un escudo! Presiona Romper cuando la barra esté en verde :o");

        // Capa del escudo: misma hitbox que el jefe, así que cubre todo el jefe
        layer = document.createElement("div");
        layer.className = "bossShieldLayer";

        shieldImage = document.createElement("img");
        shieldImage.src = "assets/img/shield.png";
        shieldImage.alt = "Escudo";
        shieldImage.draggable = false;
        shieldImage.className = "bossShieldImg bossShieldAppear";

        const image = shieldImage;

        image.addEventListener("animationend", function onAppear() {
            image.removeEventListener("animationend", onAppear);
            image.classList.remove("bossShieldAppear");
        });

        // El escudo absorbe los toques: nunca llegan al jefe
        layer.addEventListener("pointerdown", function(event) {
            event.preventDefault();
            event.stopPropagation();
            playBossAnimation(image, "bossShieldBump");
        });

        layer.appendChild(image);
        ctx.box.appendChild(layer);

        // Barra de timing con las zonas del nivel de dificultad actual
        let zonesHtml = "";

        params.zones.forEach(function(zone) {
            zonesHtml +=
                '<span class="bossZone" data-zone="' + zone.type +
                '" style="flex: ' + zone.size + '"></span>';
        });

        timing = document.createElement("div");
        timing.className = "bossTiming";
        timing.innerHTML =
            '<div class="bossZones">' + zonesHtml + '</div>' +
            '<div class="bossIndicator"></div>' +
            '<div class="bossTimingTimer"><span></span></div>';

        indicator = timing.querySelector(".bossIndicator");
        timerEl = timing.querySelector(".bossTimingTimer");
        ctx.arena.appendChild(timing);

        window.addEventListener("resize", onResize);

        later(BOSS_SHIELD_APPEAR_TIME, beginAttempt);
    }

    /* ---------- Intento de romper ---------- */

    function beginAttempt() {
        attempt++;

        const myAttempt = attempt;
        const myRun = run;

        resolved = false;

        if (button) {
            button.remove();
        }

        button = document.createElement("button");
        button.type = "button";
        button.className = "bossBreakButton";
        button.textContent = "Romper";
        button.style.visibility = "hidden";
        button.addEventListener("pointerdown", onBreakPress);

        ctx.arena.appendChild(button);

        // Posición aleatoria evitando jefe, escudo, barra, tiempo y HUD
        placeBossButton(button, ctx.arena, avoidList());
        button.style.visibility = "";

        timing.classList.add("bossTimingOn");

        phase = Math.random() * 2;
        startTime = performance.now();

        startTimer();

        function tick(now) {
            if (myRun !== run || myAttempt !== attempt || resolved) {
                return;
            }

            setIndicator(getPosition(now));
            requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);

        // Tiempo límite: si se acaba, el escudo aguanta
        setTimeout(function() {
            if (myRun !== run || myAttempt !== attempt || resolved) {
                return;
            }

            resolved = true;

            setIndicator(getPosition(performance.now()));
            freezeTimer();

            button.disabled = true;
            button.classList.add("bossBreakUsed");

            shieldHolds("¡Muy lento! El escudo aguantó :c");
        }, params.limit);
    }

    function onBreakPress(event) {
        event.preventDefault();
        event.stopPropagation();

        if (resolved) {
            return;
        }

        resolved = true;

        const position = getPosition(performance.now());

        setIndicator(position);
        freezeTimer();

        button.disabled = true;
        button.classList.add("bossBreakUsed");

        resolveZone(getBossShieldZone(params.zones, position));
    }

    function resolveZone(zone) {
        if (zone === "green") {
            // El golpe atraviesa: el escudo se rompe y el jefe pierde 1 HP
            layer.classList.add("bossShieldBreak");
            ctx.setHint("¡Directo al jefe! ¡Pum! >:3");

            later(250, function() {
                ctx.damageBoss(1);
            });

            later(BOSS_SHIELD_RESULT_TIME, end);
            return;
        }

        if (zone === "yellow") {
            // El escudo se rompe, pero el golpe no llega al jefe
            layer.classList.add("bossShieldBreak");
            ctx.setHint("El escudo se rompió, pero el golpe no llegó al jefe :c");

            later(BOSS_SHIELD_RESULT_TIME, end);
            return;
        }

        // Rojo: el escudo detiene el golpe por completo
        shieldHolds("¡El escudo aguantó! :c");
    }

    // El escudo resiste (rojo o tiempo agotado)
        // El escudo resiste (rojo o tiempo agotado): la mecánica termina sin daño
    function shieldHolds(message) {
        playBossAnimation(shieldImage, "bossShieldBlock");

        ctx.setHint(message);
        layer.classList.add("bossShieldFade");

        later(BOSS_SHIELD_RESULT_TIME, end);
    }

    /* ---------- Fin ---------- */

    function end() {
        const finishedCtx = ctx;

        removeUi();
        ctx = null;

        finishedCtx.finish();
    }

    function cancel() {
        run++;
        removeUi();
        ctx = null;
    }

    return { id: "shield", start: start, cancel: cancel };
}

registerBossMechanic(createBossShieldMechanic());