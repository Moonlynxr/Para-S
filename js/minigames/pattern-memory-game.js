const patternItems = [
    "sun.png",
    "flower.png",
    "star.png",
    "moon.png",
    "heart.png",
];

let correctPattern = [];
let playerPattern = [];

function startGamePatternMemory() {
    showScreen(gameScreen);
    generatePattern();
    showPattern();
}

function generatePattern() {
    correctPattern = [...patternItems];
    shuffleArray(correctPattern);
    playerPattern = [];
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        const temporary = array[i];
        array[i] = array[randomIndex];
        array[randomIndex] = temporary;
    }
}

function showPattern() {

    gameContent.innerHTML = `
        <h1>¡Recuerda el patrón :p</h1>

        <div id="patternDisplay"></div>

        <p>Memoriza el orden de las figuras.</p>
    `;

    const patternDisplay =
        document.getElementById("patternDisplay");

    correctPattern.forEach(function(item) {

        const image = document.createElement("img");

        image.src = "assets/img/" + item;
        image.alt = "Figura";
        image.draggable = false;

        patternDisplay.appendChild(image); 
    });

    setTimeout(function() {
        showPuzzle();
    }, 3000);
}

function showPuzzle() {
    const shuffledItems = [...correctPattern];
    shuffleArray(shuffledItems);

    gameContent.innerHTML = `
        <h1>Ahora acomódalas</h1>
        <div id="availableItems"></div>
        <p>Arrastra cada figura en su orden</p>
        <div id="patternSlots"></div>
        <button id="checkPatternButton">Comprobar</button>
    `;

    const availableItems = document.getElementById("availableItems");
    const patternSlots = document.getElementById("patternSlots");

    shuffledItems.forEach(function(item) {

    const image = document.createElement("img");
        image.src = "assets/img/" + item;
        image.alt = "Figura";
        image.dataset.item = item;
        image.draggable = false;

        availableItems.appendChild(image);
    });

    for (let i = 0; i < 5; i++){
        const slot = document.createElement("div");
        slot.classList.add("patternSlot");
        patternSlots.appendChild(slot);
    }
    setupDragAndDrop();

    const checkButton = document.getElementById("checkPatternButton");
    checkButton.addEventListener("click", checkPattern);
}

let draggedItem = null;
let draggedItemClone = null;

function setupDragAndDrop() {

    const items = document.querySelectorAll("#availableItems img");

    items.forEach(function(item) {

        item.addEventListener("pointerdown", startDragging);
    });
}

function startDragging(event) {
    event.preventDefault();

    draggedItem = event.currentTarget;

    draggedItemClone = draggedItem.cloneNode(true);

    draggedItemClone.classList.add("draggingItem");

    document.body.appendChild(draggedItemClone);

    draggedItem.style.opacity = "0.3";

    moveDraggedItem(event);

    draggedItem.setPointerCapture(event.pointerId);

    draggedItem.addEventListener("pointermove", moveDraggedItem);
    draggedItem.addEventListener("pointerup", stopDragging);
    draggedItem.addEventListener("pointercancel", stopDragging);
}

function moveDraggedItem(event) {
    event.preventDefault();

    if (!draggedItemClone) {
        return;
    }

    draggedItemClone.style.position = "fixed";

    draggedItemClone.style.left =
        event.clientX + "px";

    draggedItemClone.style.top =
        event.clientY + "px";

    draggedItemClone.style.transform =
        "translate(-50%, -50%)";
}

function stopDragging(event){
    if(!draggedItem){
        return;
    }
     
    const slots = document.querySelectorAll(".patternSlot");
    let selectedSlot = null;
    slots.forEach(function(slot) {
        const rect = slot.getBoundingClientRect();

        const insideX =
            event.clientX >= rect.left &&
            event.clientX <= rect.right;

        const insideY =
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;

        if(insideX && insideY){
            selectedSlot = slot;
        }
    });

    if (selectedSlot){
        moveItemToSlot(draggedItem, selectedSlot);
    }

    draggedItem.style.opacity = "1";

    draggedItem.removeEventListener("pointermove", moveDraggedItem);
    draggedItem.removeEventListener("pointerup", stopDragging);
    draggedItem.removeEventListener("pointercancel", stopDragging);

    draggedItem = null;

    if(draggedItemClone) {
        draggedItemClone.remove();
        draggedItemClone = null;
    }
}

function placeItemInSlot(item, slot){
    if(slot.children.length > 0){
        return;
    }

    slot.appendChild(item);
    item.style.opacity = "1"
}

function moveItemToSlot(item, targetSlot) {
    const currentSlot = item.parentElement;

    if (currentSlot === targetSlot) {
        return;
    }

    const targetItem = targetSlot.querySelector("img");

    if (targetItem) {

        if (currentSlot.classList.contains("patternSlot")) {

            currentSlot.appendChild(targetItem);

        } else {

            document.getElementById("availableItems")
                .appendChild(targetItem);
        }
    }

    targetSlot.appendChild(item);
}

function checkPattern(){
    const slots = document.querySelectorAll(".patternSlot");

    for (let i = 0; i < slots.length; i++){
        const item = slots[i].querySelector("img");

        if(!item){
            gameContent.innerHTML += `
                <p>Primero coloca todas las figuras</p>
            `;
            return;
        }
    }

    const playerOrder = [...slots].map(function(slot) {
        return slot.querySelector("img").dataset.item;
    });

    const isCorrect = playerOrder.every(function(item, i) {
        return item === correctPattern[i];
    });

    if (isCorrect) {
        completePatternGame();
    } else {
        patternFailed();
    }
}

function patternFailed() {
    gameContent.innerHTML = `
        <h1>Ups...</h1>

        <p>Esta vez no fue. Vamos con otro patrón.</p>
    `;

    setTimeout(function() {

        generatePattern();
        showPattern();

    }, 1500);
}

function completePatternGame() {
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
    const continueButton =
        document.getElementById("continueButton");

    continueButton.addEventListener("click", function() {
        showScreen(menuScreen);
    });
}