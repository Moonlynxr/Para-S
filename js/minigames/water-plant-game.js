const WATER_GOAL_TIME = 10000;        // ms de riego efectivo (acumulado)
const WATER_SPOUT_FACES_LEFT = true;  // true si en watering-can.png la boquilla apunta a la IZQUIERDA
const WATER_MIN_TILT = 20;            // grados mínimos de inclinación hacia la tierra para regar
const WATER_MAX_TILT = 75;            // inclinación máxima visual
const WATER_MAX_DIST = 0.55;          // distancia máxima a la tierra (fracción del ancho del área)
const WATER_TIP_FACTOR = 0.5;         // qué tan lejos del centro está la boquilla (fracción del ancho de la regadera)
const WATER_DROP_INTERVAL = 70;       // ms entre gotas
const WATER_STEM_MIN = 14;            // px del tallito inicial
const WATER_STEM_MAX = 0.46;          // altura máxima del tallo (fracción del alto del área)
const WATER_FLOWER_SIZE = 0.26;       // tamaño de la flor (fracción del ancho del área)
const WATER_END_DELAY = 3200;         // ms de celebración antes de la recompensa

let waterRunToken = 0;
let waterLastTime = 0;
let waterElapsed = 0;
let waterDone = false;

let waterDragging = false;
let waterPointerId = null;
let waterGrabX = 0;
let waterGrabY = 0;
let waterCanFx = 0.2;   // posición de la regadera como fracción del área
let waterCanFy = 0.28;
let waterFlip = 1;

let waterIsWatering = false;
let waterTip = { x: 0, y: 0 };
let waterTarget = { x: 0, y: 0 };
let waterDropAccum = 0;
let waterHintState = "";

let waterEls = {};

function startGameWaterPlant() {
    showScreen(gameScreen);

    waterRunToken++;
    waterElapsed = 0;
    waterDone = false;
    waterDragging = false;
    waterPointerId = null;
    waterCanFx = 0.2;
    waterCanFy = 0.28;
    waterFlip = 1;
    waterIsWatering = false;
    waterDropAccum = 0;
    waterHintState = "";

    gameContent.innerHTML = `
        <h1>Riega mi florecita :3</h1>
        <p id="waterHint"></p>

        <div id="waterBoard">
            <div id="waterSun">
                <img src="assets/img/sun.png" alt="Sol" draggable="false">
            </div>

            <div id="waterGround"></div>

            <div id="waterPot">
                <div id="waterStem">
                    <span class="waterLeaf waterLeafL"></span>
                    <span class="waterLeaf waterLeafR"></span>
                    <img id="waterFlower" src="assets/img/flower.png" alt="Flor" draggable="false">
                </div>
                <div id="waterSoil"></div>
                <div id="waterPotRim"></div>
                <div id="waterPotBody"></div>
            </div>

            <img id="waterCan" src="assets/img/watering-can.png" alt="Regadera" draggable="false">
        </div>
    `;

    waterEls = {
        board: document.getElementById("waterBoard"),
        can: document.getElementById("waterCan"),
        soil: document.getElementById("waterSoil"),
        stem: document.getElementById("waterStem"),
        flower: document.getElementById("waterFlower"),
        leafL: document.querySelector(".waterLeafL"),
        leafR: document.querySelector(".waterLeafR"),
        hint: document.getElementById("waterHint")
    };

    setupWaterDrag();
    updateWaterHint();

    const token = waterRunToken;
    waterLastTime = performance.now();

    requestAnimationFrame(function(now) {
        waterLoop(now, token);
    });
}

function getWaterMetrics() {
    const board = waterEls.board;
    const rect = board.getBoundingClientRect();

    return {
        left: rect.left + board.clientLeft,
        top: rect.top + board.clientTop,
        bw: board.clientWidth,
        bh: board.clientHeight
    };
}

/* ---------- Arrastre de la regadera ---------- */

function setupWaterDrag() {
    const can = waterEls.can;

    can.addEventListener("pointerdown", function(event) {
        if (waterDone || waterDragging) {
            return;
        }

        event.preventDefault();

        const m = getWaterMetrics();

        waterDragging = true;
        waterPointerId = event.pointerId;

        waterGrabX = (event.clientX - m.left) - waterCanFx * m.bw;
        waterGrabY = (event.clientY - m.top) - waterCanFy * m.bh;

        can.classList.add("waterCanDragging");
        can.setPointerCapture(event.pointerId);
    });

    can.addEventListener("pointermove", function(event) {
        if (!waterDragging || event.pointerId !== waterPointerId) {
            return;
        }

        event.preventDefault();

        const m = getWaterMetrics();
        const w = can.offsetWidth;
        const h = can.offsetHeight;

        let x = (event.clientX - m.left) - waterGrabX;
        let y = (event.clientY - m.top) - waterGrabY;

        x = Math.min(Math.max(x, w / 2), m.bw - w / 2);
        y = Math.min(Math.max(y, h / 2), m.bh - h / 2);

        waterCanFx = x / m.bw;
        waterCanFy = y / m.bh;
    });

    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function(name) {
        can.addEventListener(name, function(event) {
            if (event.pointerId !== undefined && event.pointerId !== waterPointerId) {
                return;
            }

            endWaterDrag();
        });
    });

    can.addEventListener("contextmenu", function(event) {
        event.preventDefault();
    });
}

function endWaterDrag() {
    waterDragging = false;
    waterPointerId = null;
    waterIsWatering = false;

    if (waterEls.can) {
        waterEls.can.classList.remove("waterCanDragging");
    }
}

/* ---------- Bucle principal ---------- */

function waterLoop(now, token) {
    if (token !== waterRunToken) {
        return;
    }

    const dt = Math.min(now - waterLastTime, 50);
    waterLastTime = now;

    const m = getWaterMetrics();

    renderWaterCan(m);

    if (waterIsWatering) {
        waterElapsed = Math.min(waterElapsed + dt, WATER_GOAL_TIME);

        waterDropAccum += dt;

        while (waterDropAccum >= WATER_DROP_INTERVAL) {
            waterDropAccum -= WATER_DROP_INTERVAL;
            spawnWaterDrop();
        }
    }

    const progress = waterElapsed / WATER_GOAL_TIME;

    paintWaterPlant(m, progress);
    updateWaterHint();

    if (progress >= 1) {
        bloomWater(m);
        return;
    }

    requestAnimationFrame(function(time) {
        waterLoop(time, token);
    });
}

/* ---------- Regadera: posición, rotación y riego ---------- */

function renderWaterCan(m) {
    const can = waterEls.can;
    const w = can.offsetWidth;
    const h = can.offsetHeight;

    const cx = Math.min(Math.max(waterCanFx * m.bw, w / 2), m.bw - w / 2);
    const cy = Math.min(Math.max(waterCanFy * m.bh, h / 2), m.bh - h / 2);

    // Punto de referencia: la tierra de la maceta
    const soilRect = waterEls.soil.getBoundingClientRect();
    const tx = soilRect.left + soilRect.width / 2 - m.left;
    const ty = soilRect.top + soilRect.height * 0.35 - m.top;

    let rotation = 0;

    if (waterDragging) {
        const dx = tx - cx;
        const dy = ty - cy;

        const facingLeft = dx < 0;
        const tiltRaw = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
        const tilt = Math.min(Math.max(tiltRaw, 0), WATER_MAX_TILT);
        const dist = Math.hypot(dx, dy);

        // La boquilla apunta hacia la tierra: se voltea según el lado
        rotation = facingLeft ? -tilt : tilt;
        waterFlip = (facingLeft === WATER_SPOUT_FACES_LEFT) ? 1 : -1;

        waterIsWatering =
            dy > 0 &&
            tiltRaw >= WATER_MIN_TILT &&
            dist <= m.bw * WATER_MAX_DIST;

        // Posición de la boquilla (de aquí salen las gotas)
        const rad = tilt * Math.PI / 180;
        const dirX = (facingLeft ? -1 : 1) * Math.cos(rad);
        const dirY = Math.sin(rad);

        waterTip = {
            x: cx + dirX * w * WATER_TIP_FACTOR,
            y: cy + dirY * w * WATER_TIP_FACTOR
        };

        waterTarget = { x: tx, y: ty };
    } else {
        waterIsWatering = false;
    }

    can.style.transform =
        "translate(" + (cx - w / 2) + "px, " + (cy - h / 2) + "px) " +
        "rotate(" + rotation + "deg) " +
        "scaleX(" + waterFlip + ")";
}

function spawnWaterDrop() {
    const drop = document.createElement("span");
    drop.classList.add("waterDrop");

    const jitterX = (Math.random() - 0.5) * 24;
    const jitterY = (Math.random() - 0.5) * 8;

    drop.style.left = waterTip.x + "px";
    drop.style.top = waterTip.y + "px";
    drop.style.setProperty("--dx", (waterTarget.x + jitterX - waterTip.x) + "px");
    drop.style.setProperty("--dy", (waterTarget.y + jitterY - waterTip.y) + "px");
    drop.style.animationDuration = (0.45 + Math.random() * 0.2) + "s";

    drop.addEventListener("animationend", function() {
        drop.remove();
    });

    waterEls.board.appendChild(drop);
}

/* ---------- La planta ---------- */

function paintWaterPlant(m, progress) {
    const maxStem = m.bh * WATER_STEM_MAX;
    const stemPx = WATER_STEM_MIN + progress * (maxStem - WATER_STEM_MIN);

    waterEls.stem.style.height = stemPx + "px";
    waterEls.flower.style.width = (m.bw * WATER_FLOWER_SIZE) + "px";
    waterEls.board.style.setProperty("--grow", progress.toFixed(3));

    waterEls.leafL.classList.toggle("waterLeafOn", progress > 0.3);
    waterEls.leafR.classList.toggle("waterLeafOn", progress > 0.55);
}

function updateWaterHint() {
    let state = "idle";

    if (waterDone) {
        state = "done";
    } else if (waterIsWatering) {
        state = "watering";
    } else if (waterElapsed > 0) {
        state = "paused";
    }

    if (state === waterHintState) {
        return;
    }

    waterHintState = state;

    const texts = {
        idle: "Arrastra la regadera hacia la maceta :3",
        watering: "Eso, a la plantita le encanta ♡",
        paused: "No pares, sigue regándola, mi vida :3",
        done: "¡Floreció! Todo florece con cariño, igual que lo nuestro ♡"
    };

    waterEls.hint.textContent = texts[state];
}

/* ---------- Floración ---------- */

function bloomWater(m) {
    const token = waterRunToken;

    waterDone = true;
    endWaterDrag();
    updateWaterHint();

    waterEls.board.classList.add("waterBloomed");
    waterEls.can.classList.add("waterCanHide");

    // Brillitos alrededor de la flor
    const stemRect = waterEls.stem.getBoundingClientRect();
    const size = m.bw * WATER_FLOWER_SIZE;
    const centerX = stemRect.left + stemRect.width / 2 - m.left;
    const centerY = stemRect.top - m.top - size * 0.1;

    const symbols = ["✦", "♡", "✧"];

    for (let i = 0; i < 12; i++) {
        const sparkle = document.createElement("span");
        sparkle.classList.add("waterSparkle");
        sparkle.textContent = symbols[i % symbols.length];

        const angle = Math.random() * Math.PI * 2;
        const radius = size * (0.35 + Math.random() * 0.45);

        sparkle.style.left = (centerX + Math.cos(angle) * radius) + "px";
        sparkle.style.top = (centerY + Math.sin(angle) * radius) + "px";
        sparkle.style.setProperty("--sx", (Math.cos(angle) * 18) + "px");
        sparkle.style.setProperty("--sy", (-30 - Math.random() * 30) + "px");
        sparkle.style.animationDelay = (0.4 + Math.random() * 1.2) + "s";

        sparkle.addEventListener("animationend", function() {
            sparkle.remove();
        });

        waterEls.board.appendChild(sparkle);
    }

    setTimeout(function() {
        if (token === waterRunToken) {
            completeWaterGame();
        }
    }, WATER_END_DELAY);
}

/* ---------- Recompensa ---------- */

function completeWaterGame() {
    waterRunToken++;

    addKey();
    updateKeyInventory();

    currentGame++;

    gameContent.innerHTML = `
        <div id="rewardAnimation">
            <img
                id="rewardKey"
                src="assets/img/key.png"
                alt="Llave obtenida"
            >

            <span id="rewardText">+1</span>
        </div>

        <h1>¡Nuestra florecita creció! ♡</h1>

        <p>¡Has ganado una llave!</p>

        <button id="continueButton">Continuar</button>
    `;

    document.getElementById("continueButton").addEventListener("click", function() {
        showScreen(menuScreen);
    });
}