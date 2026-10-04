const chestsContainer = document.getElementById("chests");
const keyCount = document.getElementById("keyCount");

const openedChests = [];

function updateKeyInventory() {
    keyCount.textContent = getKeys();
}

function createChests() {

    chestsContainer.innerHTML = "";

    for (let i = 0; i < 9; i++) {

        const chest = document.createElement("img");

        const alreadyOpened = openedChests.includes(i);
        chest.src = alreadyOpened
            ? "assets/img/open-chest.png"
            : "assets/img/closed-chest.png";

        chest.alt = "Cofre";
        chest.classList.add("chestHidden");

        chest.addEventListener("click", function() {
            openChest(i, chest);
        });

        chestsContainer.appendChild(chest);

        setTimeout(function() {
            chest.classList.remove("chestHidden");
            chest.classList.add("chestVisible");
        }, i * 90);
    }
}

function openChest(index, chest) {

    if (openedChests.includes(index)) {
        return;
    }

    if (!useKey()) {
        return;
    }

    const isFinalChest = openedChests.length === 8;

    openedChests.push(index);

    chest.src = "assets/img/open-chest.png";

    updateKeyInventory();

    if (isFinalChest) {
        startFinalLetter(chest);

        return;
    }

    showEmptyChestMessage(index);
}

function showEmptyChestMessage(index) {

    const messageIndex = openedChests.length - 1;
    const message = getEmptyChestMessage(messageIndex);

    gameContent.innerHTML = `
        <h1>${message}</h1>
        <button id="continueButton">Continuar</button>
    `;

    showScreen(gameScreen);

    const continueButton = document.getElementById("continueButton");

    continueButton.addEventListener("click", function() {
        startNextGame();
    });
}
