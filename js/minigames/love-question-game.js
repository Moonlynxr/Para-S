const LOVE_FADE_IN = 1400;     // ms que tarda en aparecer cada frase
const LOVE_FADE_OUT = 1100;    // ms que tarda en desvanecerse
const LOVE_END_PAUSE = 1500;   // ms de pausa visual antes de la llave

// Introducción dramática: cada frase aparece sola, se queda (hold) y se va, y después hay una pausa (gap)
const LOVE_INTRO = [
    { text: "Llegaste hasta aquí...", hold: 2600, gap: 1200 },
    { text: "Atrapaste estrellas.", hold: 1500, gap: 500 },
    { text: "Limpiaste mi corazón.", hold: 1500, gap: 500 },
    { text: "Regaste una florecita.", hold: 1500, gap: 500 },
    { text: "Derrotaste a un jefe gruñón.", hold: 1900, gap: 1500 },
    { text: "Pero hay algo que todavía necesito saber...", hold: 3600, gap: 2200 },
    { text: "Una última pregunta.", hold: 2800, gap: 2800 }
];

// Las dos respuestas son válidas y llegan al mismo final
const LOVE_ROUTES = {
    yes: [
        { text: "Lo sabía.", hold: 2200, gap: 600 },
        { text: "Pero...", hold: 2400, gap: 900 },
        { text: "Quería oírlo de ti :3", hold: 3200, gap: 0 }
    ],
    no: [
        { text: "Ah...", hold: 2400, gap: 700 },
        { text: "Bueno.", hold: 2000, gap: 900 },
        { text: "Yo sí :3", hold: 3200, gap: 0 }
    ]
};

let loveRunToken = 0;   // detiene secuencias viejas si se reinicia el juego
let loveAnswered = false;

function loveWait(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

/* ---------- Fondo oscuro ---------- */

function createLoveOverlay() {
    removeLoveOverlay();

    const overlay = document.createElement("div");
    overlay.id = "loveOverlay";
    document.body.appendChild(overlay);

    // Fuerza el estado inicial para que el fundido se vea
    void overlay.offsetWidth;
    overlay.classList.add("loveOverlayOn");
}

function fadeOutLoveOverlay(ms) {
    const overlay = document.getElementById("loveOverlay");

    if (overlay) {
        overlay.style.transitionDuration = ms + "ms";
        overlay.classList.remove("loveOverlayOn");
    }
}

function removeLoveOverlay() {
    const overlay = document.getElementById("loveOverlay");

    if (overlay) {
        overlay.remove();
    }
}

/* ---------- Inicio ---------- */

function startGameLoveQuestion() {
    showScreen(gameScreen);

    loveRunToken++;
    loveAnswered = false;

    const token = loveRunToken;

    createLoveOverlay();

    gameContent.classList.add("loveStage");
    gameContent.innerHTML = `<div id="loveText" class="loveText"></div>`;

    runLoveIntro(token);
}

// Muestra una frase sola: aparece, se queda y se desvanece
async function showLoveLine(text, hold, token, extraClass) {
    const box = document.getElementById("loveText");

    if (!box || token !== loveRunToken) {
        return false;
    }

    box.className = "loveText" + (extraClass ? " " + extraClass : "");
    box.textContent = text;
    box.style.transition = "opacity " + LOVE_FADE_IN + "ms ease";

    void box.offsetWidth;
    box.classList.add("loveVisible");

    await loveWait(LOVE_FADE_IN + hold);

    if (token !== loveRunToken) {
        return false;
    }

    box.style.transition = "opacity " + LOVE_FADE_OUT + "ms ease";
    box.classList.remove("loveVisible");

    await loveWait(LOVE_FADE_OUT);

    return token === loveRunToken;
}

/* ---------- Introducción ---------- */

async function runLoveIntro(token) {
    // Deja que el fondo se oscurezca antes de la primera frase
    await loveWait(1800);

    for (const step of LOVE_INTRO) {
        const alive = await showLoveLine(step.text, step.hold, token, "");

        if (!alive) {
            return;
        }

        await loveWait(step.gap);

        if (token !== loveRunToken) {
            return;
        }
    }

    showLoveQuestion(token);
}

/* ---------- Pregunta ---------- */

async function showLoveQuestion(token) {
    gameContent.innerHTML = `
        <h1 id="loveQuestion" class="loveQuestion">¿Me amas?</h1>

        <div id="loveButtons" class="loveButtons">
            <button id="loveYes" class="loveButton">Sí</button>
            <button id="loveNo" class="loveButton">No</button>
        </div>
    `;

    document.getElementById("loveYes").addEventListener("click", function() {
        answerLove("yes", token);
    });

    document.getElementById("loveNo").addEventListener("click", function() {
        answerLove("no", token);
    });

    // Primero la pregunta sola y luego aparecen las opciones
    await loveWait(1900);

    if (token !== loveRunToken) {
        return;
    }

    document.getElementById("loveButtons").classList.add("loveButtonsOn");
}

async function answerLove(route, token) {
    if (loveAnswered || token !== loveRunToken) {
        return;
    }

    loveAnswered = true;

    document.getElementById("loveQuestion").classList.add("loveFadeOut");
    document.getElementById("loveButtons").classList.add("loveFadeOut");

    await loveWait(1200);

    if (token !== loveRunToken) {
        return;
    }

    gameContent.innerHTML = `<div id="loveText" class="loveText"></div>`;

    for (const step of LOVE_ROUTES[route]) {
        const alive = await showLoveLine(step.text, step.hold, token, "loveBig");

        if (!alive) {
            return;
        }

        if (step.gap > 0) {
            await loveWait(step.gap);
        }

        if (token !== loveRunToken) {
            return;
        }
    }

    // Pausa visual: el fondo oscuro se va aclarando antes de la llave
    await loveWait(300);

    fadeOutLoveOverlay(LOVE_END_PAUSE);

    await loveWait(LOVE_END_PAUSE);

    if (token === loveRunToken) {
        completeLoveGame();
    }
}

/* ---------- Recompensa ---------- */

function completeLoveGame() {
    loveRunToken++;

    gameContent.classList.remove("loveStage");
    removeLoveOverlay();

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

        <h1>Has conseguido una llave</h1>

        <button id="continueButton">Continuar</button>
    `;

    document.getElementById("continueButton").addEventListener("click", function() {
        showScreen(menuScreen);
    });
}