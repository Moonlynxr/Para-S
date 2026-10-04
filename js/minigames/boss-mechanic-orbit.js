const BOSS_ORBIT_SPRITES = ["sun.png", "flower.png", "star.png", "moon.png", "heart.png"];
const BOSS_ORBIT_BAR_POSITION = "bottom";  // "bottom" | "top": dónde va la barra informativa
const BOSS_ORBIT_INTRO_TIME = 900;         // ms para leer la barra antes de que corra el tiempo
const BOSS_ORBIT_RESULT_TIME = 1000;       // ms que se ve el resultado
const BOSS_ORBIT_CURVE = 0.85;             // <1: sube más rápido al principio

// Valores a 10 HP (easy) y a 1 HP (hard)
const BOSS_ORBIT_LEVELS = {
    limit: { easy: 15000, hard: 6500 },  // ms para completar la secuencia
    speed: { easy: 0.45,  hard: 1.15 },  // rad/s de la órbita
    pulse: { easy: 0,     hard: 0.3 }    // cuánto varía la velocidad (0 = constante)
};

function getBossOrbitParams(difficulty) {
    function level(key) {
        const entry = BOSS_ORBIT_LEVELS[key];
        return bossLerp(entry.easy, entry.hard, difficulty, BOSS_ORBIT_CURVE);
    }

    return {
        limit: level("limit"),
        speed: level("speed"),
        pulse: level("pulse")
    };
}

function shuffleBossOrbit(array) {
    const copy = array.slice();

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }

    return copy;
}

function clampBossOrbit(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Escudo sobre el jefe: misma capa e hitbox que usa la mecánica del escudo
function createBossOrbitShield(box) {
    const layer = document.createElement("div");
    layer.className = "bossShieldLayer";

    const image = document.createElement("img");
    image.src = "assets/img/shield.png";
    image.alt = "Escudo";
    image.draggable = false;
    image.className = "bossShieldImg bossShieldAppear";

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
    box.appendChild(layer);

    return { layer: layer, image: image };
}

function createBossOrbitMechanic() {
    let ctx = null;
    let run = 0;        // invalida callbacks al cancelar o terminar
    let attempt = 0;    // invalida bucles de intentos anteriores
    let phase = "idle"; // "intro" | "play" | "resolved"

    let params = getBossOrbitParams(0);

    let shieldLayer = null;
    let layer = null;
    let ring = null;
    let bar = null;
    let timerEl = null;

    let slots = [];
    let items = [];
    let sequence = [];
    let step = 0;
    let sizeKey = "";

    let attemptStart = 0;
    let lastNow = 0;
    let base = 0;
    let dir = 1;

    function later(ms, callback) {
        const myRun = run;

        setTimeout(function() {
            if (myRun === run) {
                callback();
            }
        }, ms);
    }

    function laterInAttempt(ms, callback) {
        const myRun = run;
        const myAttempt = attempt;

        setTimeout(function() {
            if (myRun === run && myAttempt === attempt) {
                callback();
            }
        }, ms);
    }

    function removeUi() {
        [shieldLayer, layer].forEach(function(element) {
            if (element) {
                element.remove();
            }
        });

        shieldLayer = null;
        layer = null;
        ring = null;
        bar = null;
        timerEl = null;
        slots = [];
        items = [];
    }

    /* ---------- Temporizador visual ---------- */

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

    /* ---------- Inicio ---------- */

    function start(context) {
        ctx = context;
        run++;
        attempt = 0;
        phase = "idle";

        // Todo se calcula con el HP que le queda al jefe
        params = getBossOrbitParams(ctx.difficulty);

        ctx.setHint("¡Un escudo giratorio! Toca las figuras en el orden de la barra :o");

        shieldLayer = createBossOrbitShield(ctx.box).layer;

        layer = document.createElement("div");
        layer.className = "bossOrbitLayer";
        ctx.arena.appendChild(layer);

        later(450, beginAttempt);
    }

    /* ---------- Un intento ---------- */

    function beginAttempt() {
        attempt++;

        const myRun = run;
        const myAttempt = attempt;

        phase = "intro";
        step = 0;
        sizeKey = "";
        base = Math.random() * Math.PI * 2;
        dir = Math.random() < 0.5 ? -1 : 1;

        // Orden a pulsar y orden en el que aparecen en la órbita (ambos al azar)
        sequence = shuffleBossOrbit(BOSS_ORBIT_SPRITES);
        const placement = shuffleBossOrbit(BOSS_ORBIT_SPRITES);

        layer.className = "bossOrbitLayer";
        layer.innerHTML = "";

        // Órbita (solo decorativa)
        ring = document.createElement("div");
        ring.className = "bossOrbitRing";
        layer.appendChild(ring);

        // Barra informativa: nada de aquí es interactivo
        bar = document.createElement("div");
        bar.className = "bossOrbitBar " +
            (BOSS_ORBIT_BAR_POSITION === "top" ? "bossOrbitBarTop" : "bossOrbitBarBottom");

        const slotsWrap = document.createElement("div");
        slotsWrap.className = "bossOrbitSlots";

        slots = sequence.map(function(name) {
            const slot = document.createElement("div");
            slot.className = "bossOrbitSlot";

            const image = document.createElement("img");
            image.src = "assets/img/" + name;
            image.alt = "Figura";
            image.draggable = false;

            slot.appendChild(image);
            slotsWrap.appendChild(slot);

            return slot;
        });

        slots[0].classList.add("bossOrbitNext");

        timerEl = document.createElement("div");
        timerEl.className = "bossOrbitTimer";
        timerEl.innerHTML = "<span></span>";

        bar.appendChild(slotsWrap);
        bar.appendChild(timerEl);
        layer.appendChild(bar);

        // Elementos interactivos que giran alrededor del escudo
        items = placement.map(function(name, index) {
            const element = document.createElement("div");
            element.className = "bossOrbitItem";

            const image = document.createElement("img");
            image.src = "assets/img/" + name;
            image.alt = "Figura";
            image.draggable = false;

            element.appendChild(image);

            const item = {
                el: element,
                img: image,
                sprite: name,
                slotAngle: index * (Math.PI * 2 / BOSS_ORBIT_SPRITES.length)
            };

            element.addEventListener("pointerdown", function(event) {
                onItemPress(event, item);
            });

            layer.appendChild(element);
            playBossAnimation(image, "bossOrbitIn");

            return item;
        });

        attemptStart = performance.now();
        lastNow = attemptStart;

        updateOrbit(attemptStart);

        // Después de unos instantes para leer la barra, empieza a correr el tiempo
        laterInAttempt(BOSS_ORBIT_INTRO_TIME, function() {
            phase = "play";
            startTimer();

            laterInAttempt(params.limit, function() {
                if (phase === "play") {
                    fail("¡Se acabó el tiempo! :c", null);
                }
            });
        });

        function tick(now) {
            if (myRun !== run || myAttempt !== attempt || phase === "resolved") {
                return;
            }

            updateOrbit(now);
            requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }

    /* ---------- Órbita ---------- */

    function updateOrbit(now) {
        const dt = clampBossOrbit((now - lastNow) / 1000, 0, 0.05);
        lastNow = now;

        const arena = ctx.arena;
        const aw = arena.clientWidth;
        const ah = arena.clientHeight;

        // La órbita se centra en el escudo (el centro del jefe)
        const arenaRect = arena.getBoundingClientRect();
        const boxRect = ctx.box.getBoundingClientRect();

        const cx = boxRect.left + boxRect.width / 2 - arenaRect.left - arena.clientLeft;
        const cy = boxRect.top + boxRect.height / 2 - arenaRect.top - arena.clientTop;

        // Tamaños (el área de toque es 10 px más grande que la figura)
        const elem = clampBossOrbit(ah * 0.1, 38, 54);
        const hit = elem + 10;
        const slotSize = elem * 0.85;
        const key = String(Math.round(elem));

        if (key !== sizeKey) {
            sizeKey = key;

            items.forEach(function(item) {
                item.el.style.width = hit + "px";
                item.el.style.height = hit + "px";
            });

            slots.forEach(function(slot) {
                slot.style.width = slotSize + "px";
                slot.style.height = slotSize + "px";
            });
        }

        // Radios que dejan espacio al HUD y a la barra informativa
        const atBottom = BOSS_ORBIT_BAR_POSITION !== "top";
        const barH = bar.offsetHeight;
        const topBound = atBottom ? 36 : 34 + barH + 6;
        const bottomBound = atBottom ? ah - 10 - barH - 6 : ah - 8;

        const rx = Math.max(Math.min(
            cx - hit / 2 - 4,
            aw - cx - hit / 2 - 4,
            boxRect.width / 2 + elem * 0.9
        ), 20);

        const ry = Math.max(Math.min(
            cy - topBound - hit / 2,
            bottomBound - cy - hit / 2,
            boxRect.height / 2 + elem * 0.7
        ), 20);

        // Arranque suave y velocidad con una pequeña pulsación
        const elapsed = (now - attemptStart) / 1000;
        const energy = Math.min(elapsed / (BOSS_ORBIT_INTRO_TIME / 1000), 1);
        const velocity = dir * params.speed * energy *
            (1 + params.pulse * Math.sin(elapsed * 1.7));

        base += velocity * dt;

        items.forEach(function(item) {
            const angle = base + item.slotAngle;
            const x = cx + Math.cos(angle) * rx;
            const y = cy + Math.sin(angle) * ry;

            item.el.style.transform =
                "translate(" + (x - hit / 2) + "px, " + (y - hit / 2) + "px)";
        });

        ring.style.left = (cx - rx) + "px";
        ring.style.top = (cy - ry) + "px";
        ring.style.width = (rx * 2) + "px";
        ring.style.height = (ry * 2) + "px";
    }

    /* ---------- Toques ---------- */

    function onItemPress(event, item) {
        event.preventDefault();
        event.stopPropagation();

        // Mientras se lee la barra o ya hay resultado, no cuenta
        if (phase !== "play") {
            return;
        }

        if (item.sprite !== sequence[step]) {
            fail("¡Ese no era! :c", item);
            return;
        }

        // Acierto: el elemento NO desaparece, sigue orbitando
        playBossAnimation(item.img, "bossOrbitHit");

        slots[step].classList.remove("bossOrbitNext");
        slots[step].classList.add("bossOrbitDone");

        step++;

        if (step >= sequence.length) {
            success();
            return;
        }

        slots[step].classList.add("bossOrbitNext");
    }

    function success() {
        phase = "resolved";
        freezeTimer();

        ctx.setHint("¡Secuencia perfecta! ¡Pum! >:3");

        // El escudo se rompe y el jefe pierde 1 HP
        layer.classList.add("bossOrbitOut");
        shieldLayer.classList.add("bossShieldBreak");

        later(250, function() {
            ctx.damageBoss(1);
        });

        later(BOSS_ORBIT_RESULT_TIME, end);
    }

    function fail(message, wrongItem) {
        phase = "resolved";
        freezeTimer();

        // Error bien visible: todo se pone rojo y tiembla
        layer.classList.add("bossOrbitFail");

        if (wrongItem) {
            wrongItem.el.classList.add("bossOrbitWrong");
        }

        ctx.setHint(message);

        // La órbita y el escudo se desvanecen y la mecánica termina sin daño
        later(BOSS_ORBIT_RESULT_TIME, function() {
            if (layer) {
                layer.classList.add("bossOrbitOut");
            }

            if (shieldLayer) {
                shieldLayer.classList.add("bossShieldFade");
            }
        });

        later(BOSS_ORBIT_RESULT_TIME + 350, end);
    }

    /* ---------- Fin ---------- */

    function end() {
        const finishedCtx = ctx;

        removeUi();
        ctx = null;
        phase = "idle";

        finishedCtx.finish();
    }

    function cancel() {
        run++;
        attempt++;
        removeUi();
        ctx = null;
        phase = "idle";
    }

    return { id: "orbit", start: start, cancel: cancel };
}

registerBossMechanic(createBossOrbitMechanic());