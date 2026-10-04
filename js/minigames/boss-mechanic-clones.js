const BOSS_CLONES_COUNT = 5;
const BOSS_CLONES_SCALE = 0.5;            // tamaño de cada clon respecto al jefe
const BOSS_CLONES_RESULT_TIME = 1000;     // ms que se ve el resultado
const BOSS_CLONES_SETTLE_TIME = 700;      // ms que tardan en frenar al terminar la mezcla
const BOSS_CLONES_RAMP_TIME = 600;        // ms que tardan en arrancar al empezar la mezcla
const BOSS_CLONES_BREATHE_PERIOD = 2.6;   // s por ciclo de "cierre" de la formación
const BOSS_CLONES_CURVE = 0.85;           // <1: sube más rápido al principio

// Valores a 10 HP (easy) y a 1 HP (hard)
const BOSS_CLONES_LEVELS = {
    reveal:   { easy: 1500, hard: 900 },   // ms que brilla el verdadero antes de mezclar
    shuffle:  { easy: 3000, hard: 7500 },  // ms de mezcla
    spin:     { easy: 0.8,  hard: 2.1 },   // rad/s de giro de la formación
    swapGap:  { easy: 850,  hard: 330 },   // ms entre cambios de lugar
    swapTime: { easy: 520,  hard: 320 },   // ms que dura cada cambio
    wobble:   { easy: 0.04, hard: 0.14 },  // irregularidad del radio de cada uno
    breathe:  { easy: 0,    hard: 0.42 },  // cuánto se cierra la formación hacia el centro
    flipGap:  { easy: 3000, hard: 1000 },  // ms entre cambios de dirección
    realBias: { easy: 0,    hard: 0.5 }    // prob. de que el verdadero participe en el cambio
};

function getBossClonesParams(difficulty) {
    function level(key) {
        const entry = BOSS_CLONES_LEVELS[key];
        return bossLerp(entry.easy, entry.hard, difficulty, BOSS_CLONES_CURVE);
    }

    return {
        reveal: level("reveal"),
        shuffle: level("shuffle"),
        spin: level("spin"),
        swapGap: level("swapGap"),
        swapTime: level("swapTime"),
        wobble: level("wobble"),
        breathe: level("breathe"),
        realBias: level("realBias"),
        // Los cambios de dirección empiezan a aparecer después de los primeros golpes
        flipGap: difficulty >= 0.15 ? level("flipGap") : Infinity
    };
}

function createBossClonesMechanic() {
    let ctx = null;
    let run = 0;        // invalida callbacks al cancelar o terminar
    let attempt = 0;    // invalida bucles de intentos anteriores
    let phase = "idle"; // "reveal" | "shuffle" | "settle" | "pick" | "resolved"

    let params = getBossClonesParams(0);

    let layer = null;
    let clones = [];
    let sizeKey = "";

    let lastNow = 0;
    let shuffleStart = 0;
    let shuffleEnd = 0;
    let nextSwap = Infinity;
    let nextFlip = Infinity;

    let base = 0;       // ángulo acumulado de la formación
    let velocity = 0;   // velocidad angular actual
    let dirSign = 1;
    let energy = 0;     // 0 = quietos, 1 = mezcla a tope

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

    function shortestAngle(delta) {
        return Math.atan2(Math.sin(delta), Math.cos(delta));
    }

    function removeUi() {
        if (layer) {
            layer.remove();
        }

        layer = null;
        clones = [];
    }

    /* ---------- Inicio ---------- */

    function start(context) {
        ctx = context;
        run++;
        attempt = 0;
        phase = "idle";

        params = getBossClonesParams(ctx.difficulty);

        // El jefe original desaparece
        ctx.setBossVisible(false);

        layer = document.createElement("div");
        layer.className = "bossCloneLayer";
        ctx.arena.appendChild(layer);

        later(200, beginAttempt);
    }

    /* ---------- Un intento ---------- */

    function beginAttempt() {
        attempt++;

        const myRun = run;
        const myAttempt = attempt;

        phase = "reveal";
        nextSwap = Infinity;
        nextFlip = Infinity;

        base = 0;
        velocity = 0;
        energy = 0;
        dirSign = Math.random() < 0.5 ? -1 : 1;

        layer.className = "bossCloneLayer";
        layer.innerHTML = "";
        clones = [];
        sizeKey = "";

        const realIndex = Math.floor(Math.random() * BOSS_CLONES_COUNT);

        for (let i = 0; i < BOSS_CLONES_COUNT; i++) {
            const element = document.createElement("div");
            element.className = "bossClone";

            const image = document.createElement("img");
            image.src = "assets/img/boss.png";
            image.alt = "Jefe";
            image.draggable = false;

            element.appendChild(image);

            const clone = {
                el: element,
                img: image,
                isReal: i === realIndex,
                baseOffset: i * (Math.PI * 2 / BOSS_CLONES_COUNT),
                anim: null
            };

            element.addEventListener("pointerdown", function(event) {
                onClonePress(event, clone);
            });

            layer.appendChild(element);
            clones.push(clone);

            playBossAnimation(image, "bossCloneIn");
        }

        const now = performance.now();

        lastNow = now;
        shuffleStart = now;
        updateClones(now);

        // Pista: el verdadero brilla con todos quietos
        const real = clones[realIndex];

        real.el.classList.add("bossCloneReveal");
        ctx.setHint("¡Se multiplicó! Mira bien cuál es el verdadero, el que brilla :o");

        laterInAttempt(params.reveal, function() {
            real.el.classList.remove("bossCloneReveal");
            startShuffle();
        });

        function tick(time) {
            if (myRun !== run || myAttempt !== attempt || phase === "resolved") {
                return;
            }

            updateClones(time);
            requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }

    function startShuffle() {
        const now = performance.now();

        phase = "shuffle";
        shuffleStart = now;
        shuffleEnd = now + params.shuffle;

        nextSwap = now + 500;
        nextFlip = params.flipGap === Infinity
            ? Infinity
            : now + params.flipGap * (0.7 + Math.random() * 0.6);

        ctx.setHint("¡Síguelo con la mirada! :o");
    }

    /* ---------- Movimiento ---------- */

    function getLayout() {
        const aw = ctx.arena.clientWidth;
        const ah = ctx.arena.clientHeight;

        const w = ctx.box.offsetWidth * BOSS_CLONES_SCALE;
        const h = ctx.box.offsetHeight * BOSS_CLONES_SCALE;

        const cx = aw / 2;
        const cy = ah * 0.5;

        // Radios con margen para que la formación nunca se salga del área
        const rxMax = aw / 2 - w / 2 - 6;
        const ryMax = Math.min(cy - h / 2 - 36, ah - cy - h / 2 - 6);

        return {
            aw: aw,
            ah: ah,
            w: w,
            h: h,
            cx: cx,
            cy: cy,
            rx: Math.max(Math.min(aw * 0.34, rxMax / 1.35), 0),
            ry: Math.max(Math.min(ah * 0.30, ryMax / 1.35), 0)
        };
    }

    function startSwap(now) {
        const free = clones.filter(function(clone) {
            return !clone.anim;
        });

        if (free.length < 2) {
            return;
        }

        // A mayor dificultad, el verdadero participa más seguido en los cambios
        const real = free.find(function(clone) {
            return clone.isReal;
        });

        let a;

        if (real && Math.random() < params.realBias) {
            a = real;
            free.splice(free.indexOf(real), 1);
        } else {
            a = free.splice(Math.floor(Math.random() * free.length), 1)[0];
        }

        const b = free[Math.floor(Math.random() * free.length)];

        const duration = params.swapTime * (0.85 + Math.random() * 0.3);
        const sign = Math.random() < 0.5 ? 1 : -1;

        // Uno pasa por fuera y el otro por dentro, como en el juego de los vasos
        a.anim = {
            from: a.baseOffset,
            delta: shortestAngle(b.baseOffset - a.baseOffset),
            start: now,
            dur: duration,
            sign: sign
        };

        b.anim = {
            from: b.baseOffset,
            delta: shortestAngle(a.baseOffset - b.baseOffset),
            start: now,
            dur: duration,
            sign: -sign
        };
    }

    function updateClones(now) {
        const dt = Math.min(Math.max((now - lastNow) / 1000, 0), 0.05);
        lastNow = now;

        const L = getLayout();
        const key = Math.round(L.w) + "x" + Math.round(L.h);

        if (key !== sizeKey) {
            sizeKey = key;

            clones.forEach(function(clone) {
                clone.el.style.width = L.w + "px";
                clone.el.style.height = L.h + "px";
            });
        }

        // Fases de la mezcla
        if (phase === "shuffle" && now >= shuffleEnd) {
            phase = "settle";
        }

        if (phase === "shuffle") {
            energy = Math.min(1, energy + dt / (BOSS_CLONES_RAMP_TIME / 1000));

            if (now >= nextFlip) {
                dirSign = -dirSign;
                nextFlip = now + params.flipGap * (0.7 + Math.random() * 0.6);
            }

            if (now >= nextSwap) {
                startSwap(now);
                nextSwap = now + params.swapGap * (0.8 + Math.random() * 0.4);
            }
        } else if (phase === "settle") {
            energy = Math.max(0, energy - dt / (BOSS_CLONES_SETTLE_TIME / 1000));
        } else {
            energy = 0;
            velocity = 0;
        }

        // Giro de la formación (con cambios de dirección suaves)
        const targetVelocity = dirSign * params.spin * energy;

        velocity += (targetVelocity - velocity) * Math.min(1, dt * 3);
        base += velocity * dt;

        const ts = Math.max((now - shuffleStart) / 1000, 0);

        // La formación respira: se cierra hacia el centro y vuelve a abrirse
        const breathe = 1 - params.breathe * energy *
            (0.5 - 0.5 * Math.cos(2 * Math.PI * ts / BOSS_CLONES_BREATHE_PERIOD));

        clones.forEach(function(clone, index) {
            let offset = clone.baseOffset;
            let bump = 0;

            if (clone.anim) {
                const p = Math.min((now - clone.anim.start) / clone.anim.dur, 1);
                const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

                offset = clone.anim.from + clone.anim.delta * eased;
                bump = clone.anim.sign * 0.18 * Math.sin(Math.PI * p);

                if (p >= 1) {
                    clone.baseOffset = clone.anim.from + clone.anim.delta;
                    clone.anim = null;
                }
            }

            const angle = base + offset;
            const radiusFactor =
                breathe *
                (1 + params.wobble * energy * Math.sin(ts * (1.3 + index * 0.27) + index * 1.7)) +
                bump;

            let x = L.cx + Math.cos(angle) * L.rx * radiusFactor;
            let y = L.cy + Math.sin(angle) * L.ry * radiusFactor;

            x = Math.min(Math.max(x, L.w / 2 + 4), L.aw - L.w / 2 - 4);
            y = Math.min(Math.max(y, L.h / 2 + 34), L.ah - L.h / 2 - 4);

            clone.el.style.transform =
                "translate(" + (x - L.w / 2) + "px, " + (y - L.h / 2) + "px)";
        });

        // Ya frenaron todos y no queda ningún cambio en curso: toca elegir
        if (
            phase === "settle" &&
            energy <= 0 &&
            Math.abs(velocity) < 0.05 &&
            !clones.some(function(clone) { return clone.anim; })
        ) {
            velocity = 0;
            phase = "pick";

            ctx.setHint("¡Ahora tócalo! ¿Cuál era el verdadero? >:3");
        }
    }

    /* ---------- Toques ---------- */

    function onClonePress(event, clone) {
        event.preventDefault();
        event.stopPropagation();

        // Solo se puede elegir cuando terminó el movimiento
        if (phase !== "pick") {
            return;
        }

        phase = "resolved";

        if (clone.isReal) {
            winAttempt();
        } else {
            missAttempt(clone);
        }
    }

    function winAttempt() {
        ctx.setHint("¡Ese era el verdadero! ¡Pum! >:3");

        // Los clones desaparecen
        layer.classList.add("bossCloneOut");

        later(450, function() {
            if (layer) {
                layer.remove();
                layer = null;
            }

            clones = [];

            // Vuelve el jefe original y recibe el golpe
            ctx.setBossVisible(true);
            ctx.damageBoss(1);
        });

        later(450 + BOSS_CLONES_RESULT_TIME, end);
    }

    function missAttempt(clone) {
        playBossAnimation(clone.img, "bossCloneMiss");

        // Se queda congelado y se muestra cuál era el verdadero
        clones.forEach(function(item) {
            if (item.isReal) {
                item.el.classList.add("bossCloneReveal");
            }
        });

        ctx.setHint("¡Ese era un clon! El verdadero era el que brilla :c");

        // Los clones se desvanecen, vuelve el jefe y la mecánica termina sin daño
        later(BOSS_CLONES_RESULT_TIME, function() {
            if (layer) {
                layer.classList.add("bossCloneOut");
            }

            ctx.setBossVisible(true);
        });

        later(BOSS_CLONES_RESULT_TIME + 350, end);
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

    return { id: "clones", start: start, cancel: cancel };
}

registerBossMechanic(createBossClonesMechanic());