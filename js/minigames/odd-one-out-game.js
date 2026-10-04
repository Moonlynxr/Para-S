const ODD_SPRITES = ["flower.png", "moon.png", "sun.png", "star.png"];
const ODD_GRID_SIZES = [2, 3, 4, 5];   // una cuadrícula por ronda
const ODD_TOTAL_ROUNDS = ODD_GRID_SIZES.length;

const ODD_EFFECTS = ["oddDiffHue", "oddDiffFade", "oddDiffSmall", "oddDiffGray"];

const ODD_NEXT_ROUND_TIME = 700;  // ms antes de pasar a la siguiente ronda
const ODD_ERROR_TIME = 1500;      // ms antes de reiniciar tras un error

const oddSuccessMessages = [
    "¡Eso! :3",
    "¡Qué ojito tienes, mi vida!",
    "Sabía que lo ibas a encontrar ♡"
];

let oddRound = 1;
let oddCorrectIndex = 0;
let oddLastSprite = "";
let oddInputEnabled = false;
let oddRunToken = 0; // invalida timeouts viejos al reiniciar o salir

function startGameOddOneOut() {
    showScreen(gameScreen);

    oddRunToken++;
    oddRound = 1;
    oddLastSprite = "";

    gameContent.innerHTML = `
        <h1>¿Cuál es el diferente? :o</h1>
        <p id="oddStatus"></p>

        <div id="oddGrid"></div>
    `;

    startOddRound();
}

function setOddStatus(text) {
    const status = document.getElementById("oddStatus");

    if (status) {
        status.textContent = text;
    }
}

function pickOddSprite() {
    // Intenta no repetir el mismo dibujo de la ronda anterior
    let sprite;

    do {
        sprite = ODD_SPRITES[Math.floor(Math.random() * ODD_SPRITES.length)];
    } while (sprite === oddLastSprite);

    oddLastSprite = sprite;

    return sprite;
}

function startOddRound() {
    const grid = document.getElementById("oddGrid");

    if (!grid) {
        return;
    }

    const size = ODD_GRID_SIZES[oddRound - 1];
    const total = size * size;
    const sprite = pickOddSprite();
    const effect = ODD_EFFECTS[Math.floor(Math.random() * ODD_EFFECTS.length)];

    oddCorrectIndex = Math.floor(Math.random() * total);

    grid.innerHTML = "";
    grid.style.setProperty("--odd-cols", size);
    grid.classList.toggle("oddGridDense", size >= 4);

    for (let i = 0; i < total; i++) {
        const cell = document.createElement("div");
        cell.classList.add("oddCell");

        const image = document.createElement("img");
        image.src = "assets/img/" + sprite;
        image.alt = "Figura";
        image.draggable = false;

        if (i === oddCorrectIndex) {
            image.classList.add(effect);
        }

        cell.appendChild(image);

        cell.addEventListener("click", function() {
            handleOddClick(cell, i);
        });

        grid.appendChild(cell);
    }

    setOddStatus("Ronda " + oddRound + " de " + ODD_TOTAL_ROUNDS + " · Busca el diferente :p");
    oddInputEnabled = true;
}

function handleOddClick(cell, index) {
    if (!oddInputEnabled) {
        return;
    }

    oddInputEnabled = false;

    if (index !== oddCorrectIndex) {
        failOddGame(cell);
        return;
    }

    cell.classList.add("oddCorrect");

    if (oddRound === ODD_TOTAL_ROUNDS) {
        setOddStatus("¡Lo encontraste! :3");
        const token = oddRunToken;

        setTimeout(function() {
            if (token === oddRunToken) {
                completeOddGame();
            }
        }, ODD_NEXT_ROUND_TIME);

        return;
    }

    setOddStatus(oddSuccessMessages[(oddRound - 1) % oddSuccessMessages.length]);
    oddRound++;

    const token = oddRunToken;

    setTimeout(function() {
        if (token === oddRunToken) {
            startOddRound();
        }
    }, ODD_NEXT_ROUND_TIME);
}

function failOddGame(cell) {
    const token = oddRunToken;

    cell.classList.add("oddWrong");

    // Pistita para que vea cuál era
    const cells = document.querySelectorAll(".oddCell");

    if (cells[oddCorrectIndex]) {
        cells[oddCorrectIndex].classList.add("oddReveal");
    }

    setOddStatus("Uy, inténtalo de nuevo :c");

    setTimeout(function() {
        if (token !== oddRunToken) {
            return;
        }

        // Nueva partida desde la ronda 1 con configuración distinta
        oddRound = 1;
        oddLastSprite = "";
        startOddRound();
    }, ODD_ERROR_TIME);
}

function completeOddGame() {
    oddRunToken++;

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

        <h1>¡Qué buena vista tienes! :3</h1>

        <p>¡Has ganado una llave!</p>

        <button id="continueButton">Continuar</button>
    `;

    document.getElementById("continueButton").addEventListener("click", function() {
        showScreen(menuScreen);
    });
}