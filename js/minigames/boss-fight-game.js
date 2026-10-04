const BOSS_MAX_HP = 10;
const BOSS_RECOIL_DELAY = 250;   // ms entre el toque y el inicio de la mecánica
const BOSS_VICTORY_TIME = 2400;  // ms de celebración antes de la recompensa
const BOSS_HEAL_CHANCE = 0.33;   // probabilidad de que el jefe recupere 1 HP después de un fallo

const BOSS_READY_TEXT = "Toca al jefe para atacarlo :3";

const bossMechanics = [];        // registro de mecánicas intercambiables

let bossHp = BOSS_MAX_HP;
let bossState = "ready";         // "ready" | "mechanic" | "done"
let bossRunToken = 0;            // invalida timeouts y bucles viejos
let bossLastMechanicId = null;
let bossDamagedThisTurn = false;   // true si la mecánica en curso logró hacerle daño al jefe
let bossActiveMechanic = null;
let bossEls = {};

/* ---------- Registro de mecánicas ---------- */

// Una mecánica es un objeto { id, start(ctx), cancel() }.
// Cuando termina debe llamar a ctx.finish(). Para hacer daño: ctx.damageBoss(n).
function registerBossMechanic(mechanic) {
    bossMechanics.push(mechanic);
}

function pickBossMechanic() {
    // Si hay más de una, evita repetir la anterior
    const pool = bossMechanics.length > 1
        ? bossMechanics.filter(function(m) { return m.id !== bossLastMechanicId; })
        : bossMechanics;

    const mechanic = pool[Math.floor(Math.random() * pool.length)];
    bossLastMechanicId = mechanic.id;

    return mechanic;
}

// 0 = dificultad base (10 HP) · ~0.56 = alta (5 HP) · 1 = máxima (1 HP)
function getBossDifficulty() {
    return (BOSS_MAX_HP - bossHp) / (BOSS_MAX_HP - 1);
}

// Interpola entre el valor fácil y el difícil. "curve" < 1 sube la dificultad más rápido al inicio
function bossLerp(easy, hard, difficulty, curve) {
    const clamped = Math.min(Math.max(difficulty, 0), 1);
    const t = Math.pow(clamped, curve === undefined ? 1 : curve);

    return easy + (hard - easy) * t;
}

/* ---------- Inicio ---------- */

function startGameBoss() {
    showScreen(gameScreen);

    stopBossActiveMechanic();

    bossRunToken++;
    bossHp = BOSS_MAX_HP;
    bossState = "ready";
    bossLastMechanicId = null;
    bossDamagedThisTurn = false;

    let segments = "";

    for (let i = 0; i < BOSS_MAX_HP; i++) {
        segments += '<span class="bossHpSeg"></span>';
    }

    gameContent.innerHTML = `
        <h1>¡Derrota al jefe gruñón! >:3</h1>
        <p id="bossHint"></p>

        <div id="bossArena">
            <div id="bossHud">
                <span id="bossHudLabel">Jefe</span>
                <div id="bossHpBar">${segments}</div>
            </div>

            <div id="bossStage">
                <div id="bossBox">
                    <img id="bossImage" src="assets/img/boss.png" alt="Jefe" draggable="false">
                </div>
            </div>
        </div>
    `;

    bossEls = {
        arena: document.getElementById("bossArena"),
        hud: document.getElementById("bossHud"),
        box: document.getElementById("bossBox"),
        image: document.getElementById("bossImage"),
        hint: document.getElementById("bossHint"),
        segments: document.querySelectorAll(".bossHpSeg")
    };

    updateBossHud();
    setBossHint(BOSS_READY_TEXT);

    bossEls.box.addEventListener("pointerdown", onBossPointerDown);
}

function setBossHint(text) {
    if (bossEls.hint) {
        bossEls.hint.textContent = text;
    }
}

function updateBossHud() {
    bossEls.segments.forEach(function(segment, index) {
        segment.classList.toggle("bossHpLost", index >= bossHp);
    });
}

/* ---------- Golpe al jefe ---------- */

function onBossPointerDown(event) {
    // Solo se puede atacar cuando no hay ninguna mecánica activa
    if (bossState !== "ready") {
        return;
    }

    event.preventDefault();

    bossState = "mechanic";

    playBossAnimation(bossEls.image, "bossRecoil");

    const token = bossRunToken;

    setTimeout(function() {
        if (token !== bossRunToken) {
            return;
        }

        const mechanic = pickBossMechanic();

        bossActiveMechanic = mechanic;
        mechanic.start(createBossContext());
    }, BOSS_RECOIL_DELAY);
}

// Lo que las mecánicas pueden usar del núcleo
function createBossContext() {
    const token = bossRunToken;

    return {
        arena: bossEls.arena,
        box: bossEls.box,                          // hitbox del jefe
        avoid: [bossEls.hud, bossEls.box],         // zonas donde no poner botones
        setHint: setBossHint,

        damageBoss: function(amount) {
            if (token === bossRunToken) {
                applyBossDamage(amount);
            }
        },

        finish: function() {
            if (token === bossRunToken) {
                finishBossMechanic();
            }
        },
        
        maxHp: BOSS_MAX_HP,
        difficulty: getBossDifficulty(),

        getHp: function() {
            return bossHp;
        },

        setBossVisible: function(visible) {
            if (token === bossRunToken) {
                bossEls.box.classList.toggle("bossHidden", !visible);
            }
        },
    };
}

function applyBossDamage(amount) {
    bossHp = Math.max(bossHp - amount, 0);

    // Hubo golpe exitoso en este turno
    if (amount > 0) {
        bossDamagedThisTurn = true;
    }

    updateBossHud();
    playBossAnimation(bossEls.image, "bossHurt");
}

function finishBossMechanic() {
    bossActiveMechanic = null;

    // Éxito = la mecánica logró hacerle daño al jefe; si no, fue un fallo
    const succeeded = bossDamagedThisTurn;
    bossDamagedThisTurn = false;

    if (bossHp <= 0) {
        startBossVictory();
        return;
    }

    bossState = "ready";

    // Fallo: 33% de que el jefe recupere 1 HP (cada fallo es una tirada independiente)
    if (!succeeded && Math.random() < BOSS_HEAL_CHANCE && bossHp < BOSS_MAX_HP) {
        healBoss(1);
        setBossHint("¡El jefe recuperó 1 HP! " + BOSS_READY_TEXT);
        return;
    }

    setBossHint(BOSS_READY_TEXT);
}

function healBoss(amount) {
    // Nunca pasa de BOSS_MAX_HP
    bossHp = Math.min(bossHp + amount, BOSS_MAX_HP);

    updateBossHud();
    playBossAnimation(bossEls.image, "bossHeal");
}

function stopBossActiveMechanic() {
    if (bossActiveMechanic) {
        bossActiveMechanic.cancel();
        bossActiveMechanic = null;
    }
}

/* ---------- Utilidades para las mecánicas ---------- */

// Reinicia una animación CSS de una clase y la quita al terminar
function playBossAnimation(element, className) {
    if (!element) {
        return;
    }

    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);

    element.addEventListener("animationend", function handler(event) {
        if (event.target !== element) {
            return;
        }

        element.removeEventListener("animationend", handler);
        element.classList.remove(className);
    });
}

// Coloca un botón en una posición aleatoria del área evitando ciertos elementos
function placeBossButton(button, arena, avoidElements) {
    const pad = 12;
    const margin = 8;

    const arenaRect = arena.getBoundingClientRect();
    const left0 = arenaRect.left + arena.clientLeft;
    const top0 = arenaRect.top + arena.clientTop;
    const areaW = arena.clientWidth;
    const areaH = arena.clientHeight;

    const buttonW = button.offsetWidth;
    const buttonH = button.offsetHeight;

    const zones = avoidElements.filter(Boolean).map(function(element) {
        const r = element.getBoundingClientRect();

        return {
            left: r.left - pad,
            right: r.right + pad,
            top: r.top - pad,
            bottom: r.bottom + pad
        };
    });

    // Respaldo: abajo a la izquierda
    let x = margin;
    let y = areaH - buttonH - margin;

    for (let i = 0; i < 80; i++) {
        const tryX = margin + Math.random() * Math.max(areaW - buttonW - margin * 2, 0);
        const tryY = margin + Math.random() * Math.max(areaH - buttonH - margin * 2, 0);

        const rect = {
            left: left0 + tryX,
            right: left0 + tryX + buttonW,
            top: top0 + tryY,
            bottom: top0 + tryY + buttonH
        };

        const overlaps = zones.some(function(z) {
            return rect.left < z.right && rect.right > z.left &&
                   rect.top < z.bottom && rect.bottom > z.top;
        });

        if (!overlaps) {
            x = tryX;
            y = tryY;
            break;
        }
    }

    button.style.left = x + "px";
    button.style.top = y + "px";
}

/* ---------- Victoria ---------- */

function startBossVictory() {
    const token = bossRunToken;

    bossState = "done";
    setBossHint("¡Derrotaste al jefe! Eres lo máximo ♡");

    bossEls.box.classList.add("bossDefeated");
    spawnBossSparkles();

    setTimeout(function() {
        if (token === bossRunToken) {
            completeBossGame();
        }
    }, BOSS_VICTORY_TIME);
}

function spawnBossSparkles() {
    const arena = bossEls.arena;
    const arenaRect = arena.getBoundingClientRect();
    const boxRect = bossEls.box.getBoundingClientRect();

    const centerX = boxRect.left + boxRect.width / 2 - arenaRect.left - arena.clientLeft;
    const centerY = boxRect.top + boxRect.height / 2 - arenaRect.top - arena.clientTop;

    const symbols = ["✦", "♡", "✧"];

    for (let i = 0; i < 14; i++) {
        const sparkle = document.createElement("span");
        sparkle.classList.add("bossSparkle");
        sparkle.textContent = symbols[i % symbols.length];

        const angle = Math.random() * Math.PI * 2;
        const radius = boxRect.width * (0.3 + Math.random() * 0.6);

        sparkle.style.left = (centerX + Math.cos(angle) * radius) + "px";
        sparkle.style.top = (centerY + Math.sin(angle) * radius) + "px";
        sparkle.style.setProperty("--sx", (Math.cos(angle) * 20) + "px");
        sparkle.style.setProperty("--sy", (-30 - Math.random() * 30) + "px");
        sparkle.style.animationDelay = (Math.random() * 1.2) + "s";

        sparkle.addEventListener("animationend", function() {
            sparkle.remove();
        });

        arena.appendChild(sparkle);
    }
}

/* ---------- Recompensa ---------- */

function completeBossGame() {
    stopBossActiveMechanic();
    bossRunToken++;

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

        <h1>¡Derrotaste al jefe! ♡</h1>

        <p>¡Has ganado una llave!</p>

        <button id="continueButton">Continuar</button>
    `;

    document.getElementById("continueButton").addEventListener("click", function() {
        showScreen(menuScreen);
    });
}