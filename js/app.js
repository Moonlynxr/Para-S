const startButton = document.getElementById('startButton');

const startScreen = document.getElementById('startScreen');
const menuScreen = document.getElementById('menu');
const gameScreen = document.getElementById('gameScreen');
const gameContent = document.getElementById('gameContent');
const envelopeScreen = document.getElementById('envelopeScreen');
const envelopeContent = document.getElementById('envelopeContent');

let currentGame = 1;

function showScreen(screen) {
    startScreen.style.display = "none";
    menuScreen.style.display = "none";
    gameScreen.style.display = "none";
    envelopeScreen.style.display = "none";

    screen.style.display = "flex";

    if (screen === menuScreen) {
        createChests();
        updateKeyInventory();
    }    
}

function showGame(content) {
    gameContent.innerHTML = content;
    showScreen(gameScreen);
}

startButton.addEventListener('click', function() {
    startNextGame();
});

function startNextGame() {
    if (currentGame === 1) {
        startGameSimpleQuestion();
    }
    if (currentGame === 2) {
        startGamePatternMemory();
    }

    if (currentGame === 3) {
        startGameSequenceMemory();
    }

    if (currentGame === 4) {
        startGameStarCatching();
    }

    if (currentGame === 5){
        startGameHeartCleaning();
    }

    if (currentGame === 6){
        startGameOddOneOut();
    }

    if (currentGame === 7){
        startGameWaterPlant();
    }
    
    if (currentGame === 8){
        startGameBoss();
    }

    if (currentGame === 9){
        startGameLoveQuestion();
    }
}