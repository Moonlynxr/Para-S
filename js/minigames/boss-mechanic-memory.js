const BOSS_MEMORY_GRID = 5;
const BOSS_MEMORY_PRE_TIME = 600;       // ms con la cuadrícula apagada antes de iluminar
const BOSS_MEMORY_RESULT_TIME = 1000;   // ms que se ve el acierto
const BOSS_MEMORY_FAIL_TIME = 1800;     // ms que se ve el error antes de reiniciar
const BOSS_MEMORY_CURVE = 0.85;         // <1: sube más rápido al principio

// Valores a 10 HP (easy) y a 1 HP (hard)
const BOSS_MEMORY_LEVELS = {
    count:    { easy: 5,    hard: 12 },    // cuadros iluminados
    showTime: { easy: 5500, hard: 2600 },  // ms para memorizar
    clusters: { easy: 1,    hard: 3 },     // cuántas "manchas" separadas forman el patrón
    symmetry: { easy: 0.85, hard: 0 }      // probabilidad de que el patrón sea simétrico
};

function getBossMemoryParams(difficulty) {
    function level(key) {
        const entry = BOSS_MEMORY_LEVELS[key];
        return bossLerp(entry.easy, entry.hard, difficulty, BOSS_MEMORY_CURVE);
    }

    return {
        count: Math.round(level("count")),
        showTime: level("showTime"),
        clusters: Math.max(1, Math.round(level("clusters"))),
        symmetry: level("symmetry")
    };
}

/* ---------- Generador de patrones ---------- */

function pickBossMemory(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function bossMemoryNeighbors(index) {
    const n = BOSS_MEMORY_GRID;
    const row = Math.floor(index / n);
    const col = index % n;
    const result = [];

    if (row > 0) { result.push(index - n); }
    if (row < n - 1) { result.push(index + n); }
    if (col > 0) { result.push(index - 1); }
    if (col < n - 1) { result.push(index + 1); }

    return result;
}

// ¿Está esta celda separada al menos por un hueco de las manchas ajenas?
function bossMemoryIsFar(index, id, owner) {
    const n = BOSS_MEMORY_GRID;
    const row = Math.floor(index / n);
    const col = index % n;

    for (const entry of owner) {
        if (entry[1] === id) {
            continue;
        }

        const otherRow = Math.floor(entry[0] / n);
        const otherCol = entry[0] % n;

        if (Math.max(Math.abs(otherRow - row), Math.abs(otherCol - col)) < 2) {
            return false;
        }
    }

    return true;
}

// Una mancha conectada: crece celda por celda desde una semilla al azar
function growBossMemoryCluster(owner, id, size, region) {
    const total = BOSS_MEMORY_GRID * BOSS_MEMORY_GRID;
    const seeds = [];

    for (let i = 0; i < total; i++) {
        if (region(i) && !owner.has(i) && bossMemoryIsFar(i, id, owner)) {
            seeds.push(i);
        }
    }

    if (seeds.length === 0) {
        return;
    }

    owner.set(pickBossMemory(seeds), id);

    let count = 1;

    while (count < size) {
        const frontier = [];

        owner.forEach(function(ownerId, index) {
            if (ownerId !== id) {
                return;
            }

            bossMemoryNeighbors(index).forEach(function(neighbor) {
                if (
                    region(neighbor) &&
                    !owner.has(neighbor) &&
                    bossMemoryIsFar(neighbor, id, owner) &&
                    frontier.indexOf(neighbor) === -1
                ) {
                    frontier.push(neighbor);
                }
            });
        });

        if (frontier.length === 0) {
            break;
        }

        owner.set(pickBossMemory(frontier), id);
        count++;
    }
}

function splitBossMemory(count, parts) {
    const sizes = [];
    const base = Math.floor(count / parts);
    let extra = count - base * parts;

    for (let i = 0; i < parts; i++) {
        sizes.push(base + (extra > 0 ? 1 : 0));
        extra--;
    }

    return sizes;
}

// Patrón con forma: manchas conectadas (y simétrico a veces) en vez de puntos sueltos
function generateBossMemoryPattern(count, clusters, symmetric) {
    const n = BOSS_MEMORY_GRID;
    const total = n * n;
    const anywhere = function() { return true; };

    // Patrón simétrico: se arma la mitad izquierda y se refleja
    if (symmetric) {
        const leftHalf = function(index) { return (index % n) <= 2; };
        const halfTarget = Math.max(2, Math.round(count * 0.6));

        for (let attempt = 0; attempt < 40; attempt++) {
            const owner = new Map();

            growBossMemoryCluster(owner, 0, halfTarget, leftHalf);

            const cells = new Set();

            owner.forEach(function(ownerId, index) {
                const row = Math.floor(index / n);
                const col = index % n;

                cells.add(index);
                cells.add(row * n + (n - 1 - col));
            });

            if (Math.abs(cells.size - count) <= 1) {
                return Array.from(cells);
            }
        }
    }

    // Patrón normal: una o varias manchas separadas
    let best = new Map();

    for (let attempt = 0; attempt < 40; attempt++) {
        const owner = new Map();

        splitBossMemory(count, clusters).forEach(function(size, id) {
            growBossMemoryCluster(owner, id, size, anywhere);
        });

        if (owner.size > best.size) {
            best = owner;
        }

        if (owner.size === count) {
            break;
        }
    }

    // Si no cupieron todas con espacio entre manchas, se completan pegadas a las existentes
    while (best.size < count) {
        const options = [];

        for (let i = 0; i < total; i++) {
            if (!best.has(i)) {
                options.push(i);
            }
        }

        const touching = options.filter(function(index) {
            return bossMemoryNeighbors(index).some(function(neighbor) {
                return best.has(neighbor);
            });
        });

        best.set(pickBossMemory(touching.length ? touching : options), 0);
    }

    return Array.from(best.keys());
}

/* ---------- Mecánica ---------- */

function createBossMemoryMechanic() {
    let ctx = null;
    let run = 0;        // invalida callbacks al cancelar o terminar
    let attempt = 0;    // invalida intentos anteriores
    let phase = "idle"; // "pre" | "show" | "pick" | "resolved"

    let params = getBossMemoryParams(0);

    let layer = null;
    let timerEl = null;
    let timerFill = null;
    let checkButton = null;

    let cells = [];
    let pattern = [];
    let marked = new Set();

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

    /* ---------- Tamaño de la cuadrícula ---------- */

    function layoutGrid() {
        if (!layer || !ctx || !checkButton) {
            return;
        }

        const aw = ctx.arena.clientWidth;
        const ah = ctx.arena.clientHeight;

        const landscape = window.matchMedia(
            "(orientation: landscape) and (max-height: 500px)"
        ).matches;

        let side;

        if (landscape) {
            // El botón va al lado de la cuadrícula
            side = Math.min(ah - 34 - 20, aw - 24 - checkButton.offsetWidth - 16);
        } else {
            // El botón va debajo
            side = Math.min(aw - 24, ah - 34 - 6 - 8 - checkButton.offsetHeight - 20);
        }

        side = Math.min(Math.max(side, 90), 380);

        layer.style.setProperty("--mem-side", side + "px");
    }

    function removeUi() {
        window.removeEventListener("resize", layoutGrid);

        if (layer) {
            layer.remove();
        }

        layer = null;
        timerEl = null;
        timerFill = null;
        checkButton = null;
        cells = [];
    }

    /* ---------- Inicio ---------- */

    function start(context) {
        ctx = context;
        run++;
        attempt = 0;
        phase = "idle";

        // Todo se calcula con el HP que le queda al jefe
        params = getBossMemoryParams(ctx.difficulty);

        // El jefe se esconde para dejar libre el área
        ctx.setBossVisible(false);

        layer = document.createElement("div");
        layer.className = "bossMemLayer";
        ctx.arena.appendChild(layer);

        window.addEventListener("resize", layoutGrid);

        later(200, beginAttempt);
    }

    /* ---------- Un intento ---------- */

    function beginAttempt() {
        attempt++;

        phase = "pre";
        marked = new Set();

        // Patrón nuevo en cada intento
        pattern = generateBossMemoryPattern(
            params.count,
            params.clusters,
            Math.random() < params.symmetry
        );

        layer.className = "bossMemLayer";
        layer.innerHTML = "";

        const main = document.createElement("div");
        main.className = "bossMemMain";

        timerEl = document.createElement("div");
        timerEl.className = "bossMemTimer";
        timerEl.innerHTML = "<span></span>";
        timerFill = timerEl.firstElementChild;

        const grid = document.createElement("div");
        grid.className = "bossMemGrid";

        cells = [];

        for (let i = 0; i < BOSS_MEMORY_GRID * BOSS_MEMORY_GRID; i++) {
            const cell = document.createElement("div");
            cell.className = "bossMemCell";

            cell.addEventListener("pointerdown", function(event) {
                event.preventDefault();
                event.stopPropagation();
                toggleCell(i);
            });

            grid.appendChild(cell);
            cells.push(cell);
        }

        main.appendChild(timerEl);
        main.appendChild(grid);

        checkButton = document.createElement("button");
        checkButton.type = "button";
        checkButton.className = "bossMemCheck";
        checkButton.textContent = "Comprobar";
        checkButton.addEventListener("pointerdown", onCheckPress);

        layer.appendChild(main);
        layer.appendChild(checkButton);

        layoutGrid();
        updateCheckButton();

        ctx.setHint("Prepárate... ¡memoriza los cuadros que se iluminan! :o");

        laterInAttempt(BOSS_MEMORY_PRE_TIME, showPattern);
    }

    function showPattern() {
        phase = "show";

        pattern.forEach(function(index) {
            cells[index].classList.add("bossMemLit");
        });

        // Barra con el tiempo que queda para memorizar
        timerEl.classList.add("bossMemTimerOn");
        timerFill.style.transition = "none";
        timerFill.style.width = "100%";
        void timerFill.offsetWidth;
        timerFill.style.transition = "width " + params.showTime + "ms linear";
        timerFill.style.width = "0%";

        ctx.setHint("¡Memoriza! :o");

        laterInAttempt(params.showTime, hidePattern);
    }

    function hidePattern() {
        // La cuadrícula vuelve a quedar completamente vacía
        pattern.forEach(function(index) {
            cells[index].classList.remove("bossMemLit");
        });

        timerEl.classList.remove("bossMemTimerOn");

        phase = "pick";

        ctx.setHint("¡Ahora tú! Marca los " + pattern.length + " cuadros que se iluminaron :o");
        updateCheckButton();
    }

    /* ---------- Respuesta del jugador ---------- */

    function toggleCell(index) {
        if (phase !== "pick") {
            return;
        }

        if (marked.has(index)) {
            marked.delete(index);
            cells[index].classList.remove("bossMemMarked");
        } else {
            marked.add(index);
            cells[index].classList.add("bossMemMarked");
        }

        updateCheckButton();
    }

    function updateCheckButton() {
        if (!checkButton) {
            return;
        }

        const enabled = phase === "pick" && marked.size > 0;

        checkButton.textContent = phase === "pick"
            ? "Comprobar (" + marked.size + "/" + pattern.length + ")"
            : "Comprobar";

        checkButton.classList.toggle("bossMemCheckOff", !enabled);
    }

    function onCheckPress(event) {
        event.preventDefault();
        event.stopPropagation();

        if (phase !== "pick") {
            return;
        }

        if (marked.size === 0) {
            ctx.setHint("Marca algunos cuadros primero :3");
            return;
        }

        evaluate();
    }

    function evaluate() {
        phase = "resolved";
        updateCheckButton();

        const wrong = [];

        marked.forEach(function(index) {
            if (pattern.indexOf(index) === -1) {
                wrong.push(index);
            }
        });

        const missed = pattern.filter(function(index) {
            return !marked.has(index);
        });

        if (wrong.length === 0 && missed.length === 0) {
            success();
        } else {
            fail(wrong, missed);
        }
    }

    function markResult(index, className) {
        cells[index].classList.remove("bossMemMarked");
        cells[index].classList.add(className);
    }

    function success() {
        pattern.forEach(function(index) {
            markResult(index, "bossMemRight");
        });

        ctx.setHint("¡Qué memoria tienes! ¡Pum! >:3");

        later(550, function() {
            if (layer) {
                layer.classList.add("bossMemOut");
            }
        });

        later(900, function() {
            // Vuelve el jefe y recibe el golpe
            ctx.setBossVisible(true);
            ctx.damageBoss(1);
        });

        later(900 + BOSS_MEMORY_RESULT_TIME, end);
    }

    function fail(wrong, missed) {
        // Verde: los que sí eran · Rojo: los que sobraban · Naranja punteado: los que faltaron
        pattern.forEach(function(index) {
            if (marked.has(index)) {
                markResult(index, "bossMemRight");
            }
        });

        wrong.forEach(function(index) {
            markResult(index, "bossMemWrong");
        });

        missed.forEach(function(index) {
            cells[index].classList.add("bossMemMissed");
        });

        ctx.setHint("¡Ups, no era ese patrón! Fíjate cómo era :c");

        // La cuadrícula se desvanece, vuelve el jefe y la mecánica termina sin daño
        later(BOSS_MEMORY_FAIL_TIME, function() {
            if (layer) {
                layer.classList.add("bossMemOut");
            }

            ctx.setBossVisible(true);
        });

        later(BOSS_MEMORY_FAIL_TIME + 350, end);
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

    return { id: "memory", start: start, cancel: cancel };
}

registerBossMechanic(createBossMemoryMechanic());