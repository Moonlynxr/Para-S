const HEART_STAIN_TOTAL = 5;
const HEART_CLEAN_TIME = 1200;   // ms que hay que mantener presionada una mancha
const HEART_FINAL_TIME = 2600;   // ms que se ve el corazón limpio antes de la recompensa

// Posiciones en % sobre el corazón (se ajustan si quieres moverlas)
const HEART_STAIN_POSITIONS = [
    { x: 30, y: 38 },
    { x: 70, y: 36 },
    { x: 50, y: 54 },
    { x: 36, y: 68 },
    { x: 64, y: 68 }
];

let heartStains = [];
let heartCleaned = 0;
let heartRunToken = 0; // detiene bucles viejos al salir del juego
let heartLastTime = 0;

function startGameHeartCleaning() {
    showScreen(gameScreen);

    heartRunToken++;
    heartStains = [];
    heartCleaned = 0;

    gameContent.innerHTML = `
        <h1>Ayúdame a limpiar mi corazón :c</h1>
        <p id="heartStatus">Manchitas: 0 / ${HEART_STAIN_TOTAL}</p>
        <p id="heartHint">Mantén presionada cada mancha :3</p>

        <div id="heartBoard" class="heartDirty">
            <img id="heartImage" src="assets/img/heart.png" alt="Corazón" draggable="false">
        </div>
    `;

    const board = document.getElementById("heartBoard");

    HEART_STAIN_POSITIONS.forEach(function(position) {
        const image = document.createElement("img");
        image.src = "assets/img/smoke.png";
        image.alt = "Mancha";
        image.draggable = false;
        image.classList.add("heartStain");
        image.style.left = position.x + "%";
        image.style.top = position.y + "%";

        const stain = {
            el: image,
            progress: 0,
            holding: false,
            cleaned: false
        };

        image.addEventListener("pointerdown", function(event) {
            event.preventDefault();

            if (stain.cleaned) {
                return;
            }

            stain.holding = true;
            image.classList.add("heartStainHolding");
            image.setPointerCapture(event.pointerId);
        });

        ["pointerup", "pointercancel", "lostpointercapture"].forEach(function(name) {
            image.addEventListener(name, function() {
                stain.holding = false;
                image.classList.remove("heartStainHolding");
            });
        });

        // Evita el menú de "mantener presionado" en celular
        image.addEventListener("contextmenu", function(event) {
            event.preventDefault();
        });

        board.appendChild(image);
        heartStains.push(stain);
    });

    const token = heartRunToken;
    heartLastTime = performance.now();

    requestAnimationFrame(function(now) {
        heartLoop(now, token);
    });
}

function heartLoop(now, token) {
    if (token !== heartRunToken) {
        return;
    }

    const dt = now - heartLastTime;
    heartLastTime = now;

    heartStains.forEach(function(stain) {
        if (stain.holding && !stain.cleaned) {
            stain.progress = Math.min(stain.progress + dt / HEART_CLEAN_TIME, 1);
            paintHeartStain(stain);

            if (stain.progress >= 1) {
                finishHeartStain(stain);
            }
        }
    });

    if (heartCleaned < HEART_STAIN_TOTAL) {
        requestAnimationFrame(function(time) {
            heartLoop(time, token);
        });
    }
}

function paintHeartStain(stain) {
    // La mancha se encoge y se desvanece mientras la limpias
    const scale = 1 - stain.progress * 0.35;

    stain.el.style.opacity = 1 - stain.progress;
    stain.el.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
}

function finishHeartStain(stain) {
    stain.cleaned = true;
    stain.holding = false;
    stain.el.style.pointerEvents = "none";

    stain.el.classList.add("heartStainGone");

    setTimeout(function() {
        stain.el.remove();
    }, 300);

    heartCleaned++;

    const status = document.getElementById("heartStatus");

    if (status) {
        status.textContent = "Manchitas: " + heartCleaned + " / " + HEART_STAIN_TOTAL;
    }

    // El corazón se va viendo más bonito con cada mancha
    const board = document.getElementById("heartBoard");

    if (board) {
        board.style.setProperty("--heart-clean", heartCleaned / HEART_STAIN_TOTAL);
    }

    if (heartCleaned >= HEART_STAIN_TOTAL) {
        showCleanHeart();
    }
}

function showCleanHeart() {
    const token = heartRunToken;
    const board = document.getElementById("heartBoard");
    const hint = document.getElementById("heartHint");
    const status = document.getElementById("heartStatus");

    if (board) {
        board.classList.remove("heartDirty");
        board.classList.add("heartShining");
    }

    if (status) {
        status.textContent = "¡Listo! :3";
    }

    if (hint) {
        hint.textContent = "Gracias por cuidar mi corazón, siempre ha sido tuyo ♡";
        hint.classList.add("heartMessageShow");
    }

    setTimeout(function() {
        if (token === heartRunToken) {
            completeHeartGame();
        }
    }, HEART_FINAL_TIME);
}

function completeHeartGame() {
    heartRunToken++;

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

        <h1>¡Mi corazón quedó como nuevo! ♡</h1>

        <p>¡Has ganado una llave!</p>

        <button id="continueButton">Continuar</button>
    `;

    document.getElementById("continueButton").addEventListener("click", function() {
        showScreen(menuScreen);
    });
}