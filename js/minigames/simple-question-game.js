function startGameSimpleQuestion() {

    showScreen(gameScreen);

    gameContent.innerHTML = `
        <h1>¿En qué es en lo que estoy pensando todo el día?</h1>

        <button class="answerButton">a) Tú</button>
        <button class="answerButton">b) La opción a)</button>
        <button class="answerButton blueAnswer">c) Tú, pero en azul</button>
        <button class="answerButton">d) Todas las anteriores</button>
    `;

    const answerButtons = document.querySelectorAll('.answerButton');

    answerButtons.forEach(function(button) {
        button.addEventListener("click", completeGameSimpleQuestion);
    });
}

function completeGameSimpleQuestion() {

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

    const continueButton = document.getElementById('continueButton');

    continueButton.addEventListener('click', function() {
        showScreen(menuScreen);
    });
}