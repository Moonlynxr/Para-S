const BOSS_PAIRS_SPRITES = ["sun.png", "flower.png", "star.png", "moon.png", "heart.png"];
const BOSS_PAIRS_RESULT_TIME = 1000;           // ms que se ve el resultado
const BOSS_PAIRS_CURVE = 0.85;                 // <1: sube más rápido al principio

// Valores a 10 HP (easy) y a 1 HP (hard)
const BOSS_PAIRS_LEVELS = {
    limit:   { easy: 45000, hard: 20000 },  // ms para encontrar las 5 parejas
    speed:   { easy: 50,    hard: 175 },    // px/s (en un área de 400 px)
    wander:  { easy: 0,     hard: 2.0 },    // rad/s: cuánto cambian de rumbo (trayectorias menos predecibles)
    penalty: { easy: 0,     hard: 1500 }    // ms que se restan al juntar dos figuras distintas
};

function getBossPairsParams(difficulty) {
    function level(key) {
        const entry = BOSS_PAIRS_LEVELS[key];
        return bossLerp(entry.easy, entry.hard, difficulty, BOSS_PAIRS_CURVE);
    }

    return {
        limit: level("limit"),
        speed: level("speed"),
        wander: level("wander"),
        penalty: level("penalty")
    };
}

function shuffleBossPairs(array) {
    const copy = array.slice();

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }

    return copy;
}

function clampBossPairs(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function createBossPairsMechanic() {
    let ctx = null;
    let run = 0;        // invalida callbacks al cancelar o terminar
    let attempt = 0;    // invalida bucles de intentos anteriores
    let phase = "idle"; // "play" | "resolved"

    let params = getBossPairsParams(0);

    let layer = null;
    let timerEl = null;
    let timerFill = null;

    let items = [];
    let selected = null;
    let matched = 0;
    let sizeKey = "";

    let startTime = 0;
    let lastNow = 0;
    let penaltyTotal = 0;

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
        if (layer) {
            layer.remove();
        }

        layer = null;
        timerEl = null;
        timerFill = null;
        items = [];
        selected = null;
    }

    /* ---------- Inicio ---------- */

    function start(context) {
        ctx = context;
        run++;
        attempt = 0;
        phase = "idle";

        // Todo se calcula con el HP que le queda al jefe
        params = getBossPairsParams(ctx.difficulty);

        // El jefe se esconde para dejar libre toda el área
        ctx.setBossVisible(false);

        layer = document.createElement("div");
        layer.className = "bossPairsLayer";
        ctx.arena.appendChild(layer);

        later(200, beginAttempt);
    }

    /* ---------- Un intento ---------- */

    function getMetrics() {
        const aw = ctx.arena.clientWidth;
        const ah = ctx.arena.clientHeight;

        // El área de toque es 8 px más grande que la figura
        const elem = clampBossPairs(Math.min(aw, ah) * 0.12, 40, 54);
        const hit = elem + 8;
        const r = hit / 2;

        return {
            aw: aw,
            ah: ah,
            elem: elem,
            hit: hit,
            minX: r + 2,
            maxX: Math.max(aw - r - 2, r + 3),
            minY: 36 + r,                                // debajo del HUD
            maxY: Math.max(ah - 26 - r, 36 + r + 1),     // encima de la barra de tiempo
            scale: clampBossPairs(Math.min(aw, ah) / 400, 0.7, 1.5)
        };
    }

    function beginAttempt() {
        attempt++;

        const myRun = run;
        const myAttempt = attempt;

        phase = "play";
        matched = 0;
        selected = null;
        penaltyTotal = 0;
        sizeKey = "";

        layer.className = "bossPairsLayer";
        layer.innerHTML = "";

        // Barra de tiempo restante
        timerEl = document.createElement("div");
        timerEl.className = "bossPairsTimer";
        timerEl.innerHTML = "<span></span>";
        timerFill = timerEl.firstElementChild;
        layer.appendChild(timerEl);

        // Cada sprite aparece exactamente 2 veces
        const sprites = shuffleBossPairs(BOSS_PAIRS_SPRITES.concat(BOSS_PAIRS_SPRITES));

        items = sprites.map(function(name) {
            const element = document.createElement("div");
            element.className = "bossPair";

            const image = document.createElement("img");
            image.src = "assets/img/" + name;
            image.alt = "Figura";
            image.draggable = false;

            element.appendChild(image);

            const item = {
                el: element,
                img: image,
                sprite: name,
                x: 0,
                y: 0,
                dx: 1,
                dy: 0,
                factor: 0.8 + Math.random() * 0.4,   // cada una va a su propio ritmo
                omega: 0,
                omegaTimer: 0,
                done: false,
                locked: false
            };

            element.addEventListener("pointerdown", function(event) {
                onItemPress(event, item);
            });

            layer.appendChild(element);
            playBossAnimation(image, "bossPairIn");

            return item;
        });

        // Posiciones iniciales aleatorias y separadas entre sí
        const metrics = getMetrics();
        const placed = [];

        items.forEach(function(item) {
            let x = 0;
            let y = 0;
            let tries = 0;

            do {
                x = metrics.minX + Math.random() * (metrics.maxX - metrics.minX);
                y = metrics.minY + Math.random() * (metrics.maxY - metrics.minY);
                tries++;
            } while (
                tries < 300 &&
                placed.some(function(p) {
                    return Math.hypot(p.x - x, p.y - y) < metrics.hit * 1.15;
                })
            );

            placed.push({ x: x, y: y });

            const angle = Math.random() * Math.PI * 2;

            item.x = x;
            item.y = y;
            item.dx = Math.cos(angle);
            item.dy = Math.sin(angle);
        });

        startTime = performance.now();
        lastNow = startTime;

        updatePairs(startTime);

        ctx.setHint("¡Encuentra las parejas! Toca dos figuras iguales antes de que se acabe el tiempo :o");

        function tick(now) {
            if (myRun !== run || myAttempt !== attempt || phase !== "play") {
                return;
            }

            updatePairs(now);
            requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }

    /* ---------- Movimiento ---------- */

    function updatePairs(now) {
        const dt = clampBossPairs((now - lastNow) / 1000, 0, 0.05);
        lastNow = now;

        const m = getMetrics();
        const key = String(Math.round(m.hit));

        if (key !== sizeKey) {
            sizeKey = key;

            items.forEach(function(item) {
                item.el.style.width = m.hit + "px";
                item.el.style.height = m.hit + "px";
            });
        }

        const active = items.filter(function(item) {
            return !item.done;
        });

        const baseSpeed = params.speed * m.scale;

        // Movimiento: avance, cambios de rumbo suaves y rebote en los bordes
        active.forEach(function(item) {
            item.omegaTimer -= dt;

            if (item.omegaTimer <= 0) {
                item.omega = (Math.random() * 2 - 1) * params.wander;
                item.omegaTimer = 0.4 + Math.random() * 0.6;
            }

            const turn = item.omega * dt;
            const cos = Math.cos(turn);
            const sin = Math.sin(turn);
            const ndx = item.dx * cos - item.dy * sin;
            const ndy = item.dx * sin + item.dy * cos;

            item.dx = ndx;
            item.dy = ndy;

            const speed = baseSpeed * item.factor;

            item.x += item.dx * speed * dt;
            item.y += item.dy * speed * dt;

            bounceInside(item, m);
        });

        // Choques entre figuras: se separan y rebotan, así nunca quedan encimadas
        for (let i = 0; i < active.length; i++) {
            for (let j = i + 1; j < active.length; j++) {
                collide(active[i], active[j], m, baseSpeed);
            }
        }

        active.forEach(function(item) {
            bounceInside(item, m);
        });

        items.forEach(function(item) {
            item.el.style.transform =
                "translate(" + (item.x - m.hit / 2) + "px, " + (item.y - m.hit / 2) + "px)";
        });

        // Tiempo restante
        const remaining = params.limit - (now - startTime) - penaltyTotal;
        const fraction = clampBossPairs(remaining / params.limit, 0, 1);

        timerFill.style.width = (fraction * 100) + "%";
        timerEl.classList.toggle("bossPairsLow", fraction < 0.25);

        if (remaining <= 0 && phase === "play") {
            timeUp();
        }
    }

    function bounceInside(item, m) {
        if (item.x < m.minX) {
            item.x = m.minX;
            item.dx = Math.abs(item.dx);
        } else if (item.x > m.maxX) {
            item.x = m.maxX;
            item.dx = -Math.abs(item.dx);
        }

        if (item.y < m.minY) {
            item.y = m.minY;
            item.dy = Math.abs(item.dy);
        } else if (item.y > m.maxY) {
            item.y = m.maxY;
            item.dy = -Math.abs(item.dy);
        }
    }

    function collide(a, b, m, baseSpeed) {
        let ddx = b.x - a.x;
        let ddy = b.y - a.y;
        let dist = Math.hypot(ddx, ddy);

        if (dist >= m.hit) {
            return;
        }

        if (dist < 0.001) {
            ddx = 1;
            ddy = 0;
            dist = 1;
        }

        const nx = ddx / dist;
        const ny = ddy / dist;
        const overlap = m.hit - dist;

        // Separarlas
        a.x -= nx * overlap / 2;
        a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2;
        b.y += ny * overlap / 2;

        // Intercambiar la velocidad en la dirección del choque
        const sa = baseSpeed * a.factor;
        const sb = baseSpeed * b.factor;

        let vax = a.dx * sa;
        let vay = a.dy * sa;
        let vbx = b.dx * sb;
        let vby = b.dy * sb;

        const rel = (vax - vbx) * nx + (vay - vby) * ny;

        if (rel > 0) {
            vax -= rel * nx;
            vay -= rel * ny;
            vbx += rel * nx;
            vby += rel * ny;
        }

        const lenA = Math.hypot(vax, vay);
        const lenB = Math.hypot(vbx, vby);

        if (lenA > 0.001) {
            a.dx = vax / lenA;
            a.dy = vay / lenA;
        }

        if (lenB > 0.001) {
            b.dx = vbx / lenB;
            b.dy = vby / lenB;
        }
    }

    /* ---------- Toques ---------- */

    function onItemPress(event, item) {
        event.preventDefault();
        event.stopPropagation();

        if (phase !== "play" || item.done || item.locked) {
            return;
        }

        // Tocar otra vez la figura elegida la deselecciona
        if (selected === item) {
            item.el.classList.remove("bossPairSelected");
            selected = null;
            return;
        }

        if (!selected) {
            selected = item;
            item.el.classList.add("bossPairSelected");
            return;
        }

        const first = selected;

        selected = null;
        first.el.classList.remove("bossPairSelected");

        if (first.sprite === item.sprite) {
            completePair(first, item);
        } else {
            wrongPair(first, item);
        }
    }

    function completePair(a, b) {
        // Las parejas completadas dejan de ser interactivas
        a.done = true;
        b.done = true;

        a.el.classList.add("bossPairDone");
        b.el.classList.add("bossPairDone");

        later(500, function() {
            a.el.remove();
            b.el.remove();
        });

        matched++;

        if (matched >= BOSS_PAIRS_SPRITES.length) {
            success();
            return;
        }

        ctx.setHint("¡Pareja! Van " + matched + " de " + BOSS_PAIRS_SPRITES.length + " :3");
    }

    function wrongPair(a, b) {
        a.locked = true;
        b.locked = true;

        playBossAnimation(a.img, "bossPairWrong");
        playBossAnimation(b.img, "bossPairWrong");

        penaltyTotal += params.penalty;

        if (params.penalty > 0) {
            playBossAnimation(timerEl, "bossPairsTimerHit");
            ctx.setHint("¡Esas no son pareja! Pierdes un poquito de tiempo :c");
        } else {
            ctx.setHint("¡Esas no son pareja! :c");
        }

        laterInAttempt(450, function() {
            a.locked = false;
            b.locked = false;
        });
    }

    /* ---------- Resultado ---------- */

    function success() {
        phase = "resolved";

        ctx.setHint("¡Las encontraste todas! ¡Pum! >:3");

        layer.classList.add("bossPairsOut");

        later(450, function() {
            // Vuelve el jefe y recibe el golpe
            ctx.setBossVisible(true);
            ctx.damageBoss(1);
        });

        later(450 + BOSS_PAIRS_RESULT_TIME, end);
    }

    function timeUp() {
        phase = "resolved";

        ctx.setHint("¡Se acabó el tiempo! :c");

        // Las figuras se desvanecen, vuelve el jefe y la mecánica termina sin daño
        later(BOSS_PAIRS_RESULT_TIME, function() {
            if (layer) {
                layer.classList.add("bossPairsOut");
            }

            ctx.setBossVisible(true);
        });

        later(BOSS_PAIRS_RESULT_TIME + 350, end);
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

    return { id: "pairs", start: start, cancel: cancel };
}

registerBossMechanic(createBossPairsMechanic());