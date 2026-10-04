const STAR_GOAL = 10;
const STAR_SIZE = 56;            // tamaño de la estrella cayendo (px)
const STAR_DEPOSIT_SIZE = 26;    // tamaño de la estrella dentro del frasco
const STAR_MAX_ON_SCREEN = 4;
const STAR_SPAWN_MIN = 500;      // ms mínimo entre estrellas
const STAR_SPAWN_MAX = 1000;     // ms máximo entre estrellas
const STAR_GRAVITY = 380;        // px/s² de las estrellas fugaces
const STAR_FLY_TIME = 450;       // ms que tarda en volar al frasco
const STAR_JAR_GRAVITY = 1800;   // px/s² dentro del frasco
const STAR_BOUNCE = 0.45;        // qué tanto rebota

let starsCaught = 0;
let starsDeposited = 0;
let starFalling = [];
let starFlying = [];
let starLastTime = 0;
let starNextSpawn = 0;
let starRunToken = 0; // sirve para detener bucles viejos

function startGameStarCatching() {
    showScreen(gameScreen);

    starRunToken++;
    clearStarClones();
    starsCaught = 0;
    starsDeposited = 0;
    starFalling = [];

    gameContent.innerHTML = `
        <h1>Atrapa las estrellitas :3</h1>
        <p id="starCounter">Estrellas: 0 / ${STAR_GOAL}</p>

        <div id="starArea"></div>

        <div id="starJar">
            <div id="starJarLid"></div>
            <div id="starJarInner"></div>
        </div>
    `;

    const token = starRunToken;
    starLastTime = performance.now();
    starNextSpawn = starLastTime + 600;

    requestAnimationFrame(function(now) {
        starLoop(now, token);
    });
}

function updateStarCounter() {
    const counter = document.getElementById("starCounter");

    if (counter) {
        counter.textContent = "Estrellas: " + starsCaught + " / " + STAR_GOAL;
    }
}

function clearStarClones() {
    starFlying.forEach(function(clone) {
        clone.remove();
    });
    starFlying = [];
}

/* ---------- Bucle principal ---------- */

function starLoop(now, token) {
    if (token !== starRunToken) {
        return;
    }

    const area = document.getElementById("starArea");

    if (!area) {
        return;
    }

    const dt = Math.min((now - starLastTime) / 1000, 0.05);
    starLastTime = now;

    if (
        starsCaught < STAR_GOAL &&
        now >= starNextSpawn &&
        starFalling.length < STAR_MAX_ON_SCREEN
    ) {
        spawnStar(area);
        starNextSpawn = now + STAR_SPAWN_MIN +
            Math.random() * (STAR_SPAWN_MAX - STAR_SPAWN_MIN);
    }

    updateStars(area, dt, now);

    requestAnimationFrame(function(time) {
        starLoop(time, token);
    });
}

function spawnStar(area) {
    const maxX = Math.max(area.clientWidth - STAR_SIZE, 0);
    const x = Math.random() * maxX;

    const image = document.createElement("img");
    image.src = "assets/img/star.png";
    image.alt = "Estrella";
    image.draggable = false;
    image.classList.add("fallingStar");
    image.style.width = STAR_SIZE + "px";
    image.style.height = STAR_SIZE + "px";

    const star = {
        el: image,
        baseX: x,
        x: x,
        y: -STAR_SIZE,
        vy: 80 + Math.random() * 80,
        swayAmp: 10 + Math.random() * 25,
        swayFreq: 1 + Math.random() * 2,
        swayPhase: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 60,
        rot: 0,
        caught: false
    };

    image.addEventListener("pointerdown", function(event) {
        event.preventDefault();
        catchStar(star);
    });

    area.appendChild(image);
    starFalling.push(star);
    placeFallingStar(star);
}

function placeFallingStar(star) {
    star.el.style.transform =
        "translate3d(" + star.x + "px, " + star.y + "px, 0) rotate(" + star.rot + "deg)";
}

function updateStars(area, dt, now) {
    const maxX = Math.max(area.clientWidth - STAR_SIZE, 0);
    const height = area.clientHeight;

    for (let i = starFalling.length - 1; i >= 0; i--) {
        const star = starFalling[i];

        star.vy += STAR_GRAVITY * dt;
        star.y += star.vy * dt;

        const sway = Math.sin((now / 1000) * star.swayFreq + star.swayPhase) * star.swayAmp;
        star.x = Math.min(Math.max(star.baseX + sway, 0), maxX);
        star.rot += star.spin * dt;

        if (star.y > height) {
            star.el.remove();
            starFalling.splice(i, 1);
            continue;
        }

        placeFallingStar(star);
    }
}

/* ---------- Atrapar ---------- */

function catchStar(star) {
    if (star.caught || starsCaught >= STAR_GOAL) {
        return;
    }

    star.caught = true;

    const index = starFalling.indexOf(star);

    if (index !== -1) {
        starFalling.splice(index, 1);
    }

    const rect = star.el.getBoundingClientRect();
    star.el.remove();

    starsCaught++;
    updateStarCounter();

    flyStarToJar(rect, starsCaught - 1);

    // Ya llegamos a la meta: las demás estrellas se van
    if (starsCaught >= STAR_GOAL) {
        starFalling.forEach(function(other) {
            other.el.remove();
        });
        starFalling = [];
    }
}

function placeStarClone(clone, x, y, size, rotation) {
    clone.style.width = size + "px";
    clone.style.height = size + "px";
    clone.style.transform =
        "translate(" + (x - size / 2) + "px, " + (y - size / 2) + "px) rotate(" + rotation + "deg)";
}

function flyStarToJar(rect, slot) {
    const token = starRunToken;

    const jarInner = document.getElementById("starJarInner");
    const jar = document.getElementById("starJar");

    if (!jarInner || !jar) {
        return;
    }

    const clone = document.createElement("img");
    clone.src = "assets/img/star.png";
    clone.alt = "";
    clone.draggable = false;
    clone.classList.add("flyingStar");
    document.body.appendChild(clone);
    starFlying.push(clone);

    const innerRect = jarInner.getBoundingClientRect();
    const jarRect = jar.getBoundingClientRect();

    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    // Boca del frasco (con un poquito de variación)
    const mouthX = jarRect.left + jarRect.width / 2 +
        (Math.random() - 0.5) * jarRect.width * 0.25;
    const mouthY = jarRect.top;

    // Lugar donde se queda dentro del frasco
    const cols = 4;
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const restX = innerRect.left + innerRect.width * (col + 0.5) / cols;
    const restY = innerRect.bottom - 6 - STAR_DEPOSIT_SIZE / 2 -
        row * (STAR_DEPOSIT_SIZE - 4);

    const startTime = performance.now();

    function fly(now) {
        if (token !== starRunToken) {
            clone.remove();
            return;
        }

        const p = Math.min((now - startTime) / STAR_FLY_TIME, 1);
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

        const x = startX + (mouthX - startX) * eased;
        const y = startY + (mouthY - startY) * eased - Math.sin(Math.PI * p) * 40;
        const size = STAR_SIZE + (STAR_DEPOSIT_SIZE - STAR_SIZE) * eased;

        placeStarClone(clone, x, y, size, eased * 360);

        if (p < 1) {
            requestAnimationFrame(fly);
        } else {
            requestAnimationFrame(function(time) {
                dropIntoJar(clone, mouthX, mouthY, restX, restY, time, token);
            });
        }
    }

    requestAnimationFrame(fly);
}

function dropIntoJar(clone, startX, startY, restX, restY, startTime, token) {
    let x = startX;
    let y = startY;
    let vy = 120;
    let bounces = 0;
    let last = startTime;

    function fall(now) {
        if (token !== starRunToken) {
            clone.remove();
            return;
        }

        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        vy += STAR_JAR_GRAVITY * dt;
        y += vy * dt;
        x += (restX - x) * Math.min(1, dt * 8);

        if (y >= restY) {
            y = restY;

            if (vy > 80 && bounces < 2) {
                vy = -vy * STAR_BOUNCE;
                bounces++;
            } else {
                placeStarClone(clone, restX, restY, STAR_DEPOSIT_SIZE, 360);
                settleStarInJar(clone, restX, restY);
                return;
            }
        }

        placeStarClone(clone, x, y, STAR_DEPOSIT_SIZE, 360);
        requestAnimationFrame(fall);
    }

    requestAnimationFrame(fall);
}

function settleStarInJar(clone, restX, restY) {
    const jarInner = document.getElementById("starJarInner");

    clone.remove();
    starFlying = starFlying.filter(function(item) {
        return item !== clone;
    });

    if (jarInner) {
        const innerRect = jarInner.getBoundingClientRect();

        const resting = document.createElement("img");
        resting.src = "assets/img/star.png";
        resting.alt = "";
        resting.draggable = false;
        resting.classList.add("jarStar");
        resting.style.width = STAR_DEPOSIT_SIZE + "px";
        resting.style.height = STAR_DEPOSIT_SIZE + "px";
        resting.style.left =
            (restX - innerRect.left - jarInner.clientLeft - STAR_DEPOSIT_SIZE / 2) + "px";
        resting.style.top =
            (restY - innerRect.top - jarInner.clientTop - STAR_DEPOSIT_SIZE / 2) + "px";

        jarInner.appendChild(resting);
    }

    starsDeposited++;

    if (starsDeposited >= STAR_GOAL) {
        setTimeout(completeStarGame, 700);
    }
}

/* ---------- Recompensa ---------- */

function completeStarGame() {
    starRunToken++; // detiene cualquier bucle pendiente
    clearStarClones();

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

        <h1>¡Lo lograste, mi estrellita! ✦</h1>

        <p>¡Has ganado una llave!</p>

        <button id="continueButton">Continuar</button>
    `;

    document.getElementById("continueButton").addEventListener("click", function() {
        showScreen(menuScreen);
    });
}