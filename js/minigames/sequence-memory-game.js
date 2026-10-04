const SEQUENCE_TOTAL_ROUNDS = 7;
const SEQUENCE_PAD_IDS = [1, 2, 3, 4];

const SEQUENCE_SHOW_TIME = 500;   // ms que se ilumina cada recuadro
const SEQUENCE_GAP_TIME = 250;    // ms entre recuadros
const SEQUENCE_ERROR_TIME = 1500; // ms antes de reiniciar tras un error

const sequenceSuccessMessages = [ //mensajitos para mi amor
    "¡Eso! :3",
    "¡Bien hecho, mi vida!",
    "Sabía que podías ♡",
    "¡Qué lista eres!",
    "¡Casi lo logras!",
    "¡Una más y ya!"
];

let sequenceFull = [];
let sequenceRound = 1;
let sequenceInputIndex = 0;
let sequenceInputEnabled = false;

function startGameSequenceMemory() {
    showScreen(gameScreen);

    gameContent.innerHTML = `
        <h1>Ahora sigue la lucecitas :3</h1>
        <p id="sequenceStatus"></p>

        <div id="sequenceGrid" class="sequenceLocked">
            <div class="sequencePad sequencePad1" data-id="1"></div>
            <div class="sequencePad sequencePad2" data-id="2"></div>
            <div class="sequencePad sequencePad3" data-id="3"></div>
            <div class="sequencePad sequencePad4" data-id="4"></div>
        </div>
    `;

    document.querySelectorAll(".sequencePad").forEach(function(pad) {
        pad.addEventListener("click", function() {
            handleSequencePadClick(pad);
        });
    });

    resetSequenceGame();
}

function generateSequence() {
    sequenceFull = [];

    for (let i = 0; i < SEQUENCE_TOTAL_ROUNDS; i++) {
        const randomId =
            SEQUENCE_PAD_IDS[Math.floor(Math.random() * SEQUENCE_PAD_IDS.length)];
        sequenceFull.push(randomId);
    }
}

function resetSequenceGame() {
    generateSequence();
    sequenceRound = 1;
    sequenceInputIndex = 0;
    playSequenceRound();
}

function sequenceWait(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

function setSequenceStatus(text) {
    const status = document.getElementById("sequenceStatus");

    if (status) {
        status.textContent = text;
    }
}

function setSequenceInput(enabled) {
    sequenceInputEnabled = enabled;

    const grid = document.getElementById("sequenceGrid");

    if (grid) {
        grid.classList.toggle("sequenceLocked", !enabled);
    }
}

async function playSequenceRound() {
    setSequenceInput(false);
    sequenceInputIndex = 0;

    setSequenceStatus("Ronda " + sequenceRound + " de " + SEQUENCE_TOTAL_ROUNDS + " · Mira bien :p");

    await sequenceWait(800);

    const currentSequence = sequenceFull.slice(0, sequenceRound);

    for (const id of currentSequence) {
        const pad = document.querySelector('.sequencePad[data-id="' + id + '"]');

        // Si el jugador salió de la pantalla, se detiene la demostración
        if (!pad || !document.body.contains(pad)) {
            return;
        }

        pad.classList.add("sequenceLit");
        await sequenceWait(SEQUENCE_SHOW_TIME);
        pad.classList.remove("sequenceLit");
        await sequenceWait(SEQUENCE_GAP_TIME);
    }

    setSequenceStatus("Ronda " + sequenceRound + " de " + SEQUENCE_TOTAL_ROUNDS + " · Tu turno");
    setSequenceInput(true);
}

function handleSequencePadClick(pad) {
    if (!sequenceInputEnabled) {
        return;
    }

    const id = Number(pad.dataset.id);

    if (id !== sequenceFull[sequenceInputIndex]) {
        failSequenceGame();
        return;
    }

    // Feedback breve al acertar
    pad.classList.add("sequenceLit");
    setTimeout(function() {
        pad.classList.remove("sequenceLit");
    }, 200);

    sequenceInputIndex++;

    if (sequenceInputIndex === sequenceRound) {
        setSequenceInput(false);

        if (sequenceRound === SEQUENCE_TOTAL_ROUNDS) {
            setTimeout(completeSequenceGame, 500);
            return;
        }

        sequenceRound++;
        setSequenceStatus(sequenceSuccessMessages[(sequenceRound - 2) % sequenceSuccessMessages.length]);
        setTimeout(playSequenceRound, 600);
    }
}

function failSequenceGame() {
    setSequenceInput(false);

    document.querySelectorAll(".sequencePad").forEach(function(pad) {
        pad.classList.remove("sequenceLit");
        pad.classList.add("sequenceError");
    });

    setSequenceStatus("Uy, inténtalo de nuevo :c");

    setTimeout(function() {
        document.querySelectorAll(".sequencePad").forEach(function(pad) {
            pad.classList.remove("sequenceError");
        });

        resetSequenceGame();
    }, SEQUENCE_ERROR_TIME);
}

function completeSequenceGame() {
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

        <h1>¡Correcto!</h1>

        <p>¡Has ganado una llave!</p>

        <button id="continueButton">Continuar</button>
    `;

    document.getElementById("continueButton").addEventListener("click", function() {
        showScreen(menuScreen);
    });
}