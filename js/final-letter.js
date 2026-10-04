// Texto exacto de la carta (no corregir ni modificar)
const FINAL_LETTER_TEXT = [
    "Sé que quizá no llevamos tanto tiempo conociéndonos, pero lo que he llegado a sentir por ti ha crecido muchísimo, nuestra conexión se volvió algo muy especial para mí y puedo decirte con toda sinceridad que te amo como nunca antes había amado",

    "Sé que entre nosotros existen dificultades, algunas que quizá ahora mismo parecen demasiado grandes y que hacen que estar juntos no sea algo sencillo, no quiero ignorarlas ni hacer como si no existieran, porque sé que forman parte de nuestra realidad, pero tampoco quiero que esas dificultades sean lo que defina lo que sentimos, porque mientras exista una posibilidad de que algún día podamos estar juntos, haré todo lo que esté en mis manos para afrontarlas, superar lo que pueda y encontrar la manera de acercarnos a ese futuro que tanto deseo",

    "No sé qué nos tenga preparado el futuro, ni puedo prometerte que todo será fácil, pero sí puedo prometerte que mientras esté en mis manos hacer algo por nosotros, voy a intentarlo, porque si algún día la vida nos da la oportunidad de estar juntos, quiero llegar a ese momento sabiendo que hice todo lo posible por ti y por nosotros",

    "Y si algún día puedo estar contigo, quiero hacerte feliz y darte lo mejor de mí, quiero que te sientas segura conmigo, que puedas confiar en mí y que sepas que a mi lado estás bien, quiero cuidarte, apoyarte y hacerte sentir querida, porque si llegamos a tener esa oportunidad, quiero que puedas mirar hacia atrás y saber que todo lo que afrontamos valió la pena."
];

let finalStarted = false;

function finalWait(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

// Carga una imagen para conocer sus proporciones antes de calcular tamaños
function finalLoadImage(src) {
    return new Promise(function(resolve) {
        const image = new Image();

        image.onload = function() { resolve(image); };
        image.onerror = function() { resolve(image); };
        image.src = src;
    });
}

// Ancho que cabe en pantalla tanto en vertical como en horizontal
function finalImageWidth(image, maxWidth, heightFraction) {
    const ratio = (image.naturalWidth && image.naturalHeight)
        ? image.naturalHeight / image.naturalWidth
        : 1.2;

    const byHeight = (window.innerHeight * heightFraction) / ratio;

    return Math.max(Math.min(window.innerWidth * 0.72, maxWidth, byHeight), 80);
}

/* ---------- 1. El cofre se abre, sale la carta y la luz lo cubre todo ---------- */

async function startFinalLetter(chest) {
    if (finalStarted) {
        return;
    }

    finalStarted = true;

    // Un momento para ver el cofre abierto
    await finalWait(600);

    const letterSource = await finalLoadImage("assets/img/letter.png");

    const stage = document.createElement("div");
    stage.id = "finalStage";

    const light = document.createElement("div");
    light.id = "finalLight";

    const letter = document.createElement("img");
    letter.id = "finalLetter";
    letter.src = "assets/img/letter.png";
    letter.alt = "Carta";
    letter.draggable = false;
    letter.style.width = finalImageWidth(letterSource, 375, 0.5) + "px";

    const openButton = document.createElement("button");
    openButton.id = "finalOpenButton";
    openButton.type = "button";
    openButton.textContent = "Abrir";

    stage.appendChild(light);
    stage.appendChild(letter);
    stage.appendChild(openButton);
    document.body.appendChild(stage);

    try {
        await letter.decode();
    } catch (error) {
        // Si falla la decodificación, se continúa igual
    }

    // De dónde sale la carta: el cofre que se acaba de abrir
    const chestRect = chest.getBoundingClientRect();
    const originX = chestRect.left + chestRect.width / 2;
    const originY = chestRect.top + chestRect.height * 0.35;

    // Dónde termina: su lugar final en la escena
    const letterRect = letter.getBoundingClientRect();
    const dx = originX - (letterRect.left + letterRect.width / 2);
    const dy = originY - (letterRect.top + letterRect.height / 2);
    const startScale = Math.max((chestRect.width * 0.3) / (letterRect.width || 1), 0.04);

    // La luz nace en el cofre y crece hasta cubrir toda la pantalla
    const reach = Math.hypot(
        Math.max(originX, window.innerWidth - originX),
        Math.max(originY, window.innerHeight - originY)
    );
    const lightSize = (2 * reach) / 0.55 + 40;

    light.style.width = lightSize + "px";
    light.style.height = lightSize + "px";
    light.style.left = (originX - lightSize / 2) + "px";
    light.style.top = (originY - lightSize / 2) + "px";

    // Estado inicial: carta pequeña dentro del cofre
    letter.style.opacity = "0";
    letter.style.transform =
        "translate(" + dx + "px, " + dy + "px) scale(" + startScale + ")";

    void letter.offsetWidth;

    // La carta sale y crece progresivamente
    letter.style.transition =
        "transform 2800ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 600ms ease";
    letter.style.opacity = "1";
    letter.style.transform = "translate(0px, 0px) scale(1)";

    await finalWait(400);

    // Mientras crece, la luz se expande por toda la pantalla
    light.style.transition = "transform 2600ms cubic-bezier(0.4, 0, 0.6, 1)";
    light.style.transform = "scale(1)";

    await finalWait(2600);

    // Pantalla completamente blanca
    stage.style.background = "#ffffff";
    light.remove();

    /* ---------- 2. Escena del sobre ---------- */

    openButton.classList.add("finalShown");

    openButton.addEventListener("click", function() {
        openFinalEnvelope(stage, letter, openButton);
    }, { once: true });
}

/* ---------- 3. Abrir el sobre ---------- */

async function openFinalEnvelope(stage, letter, button) {
    button.classList.remove("finalShown");

    // Tiembla ligeramente mientras se desvanece
    letter.classList.add("finalShaking");

    await finalWait(1800);

    letter.remove();
    button.remove();

    showFinalPaper(stage);
}

/* ---------- 4. Aparece la hoja con el aviso "Click" ---------- */

async function showFinalPaper(stage) {
    const paperSource = await finalLoadImage("assets/img/paper.png");

    const paper = document.createElement("img");
    paper.id = "finalPaper";
    paper.src = "assets/img/paper.png";
    paper.alt = "Hoja";
    paper.draggable = false;
    paper.style.width = finalImageWidth(paperSource, 345, 0.52) + "px";

    // Aviso debajo de la hoja, con una flecha que apunta hacia ella
    const hint = document.createElement("div");
    hint.id = "finalHint";
    hint.innerHTML =
        '<svg viewBox="0 0 24 32" aria-hidden="true">' +
        '<path d="M12 0 L24 14 H16 V32 H8 V14 H0 Z"></path>' +
        '</svg>' +
        '<span>Click</span>';

    stage.appendChild(paper);
    stage.appendChild(hint);

    try {
        await paper.decode();
    } catch (error) {
        // Si falla la decodificación, se continúa igual
    }

    void paper.offsetWidth;
    paper.classList.add("finalIn");

    paper.addEventListener("click", function() {
        openFinalPaper(stage, paper, hint);
    }, { once: true });

    await finalWait(1300);

    hint.classList.add("finalShown");
}

/* ---------- 5. Tocar la hoja muestra la carta ---------- */

async function openFinalPaper(stage, paper, hint) {
    hint.classList.remove("finalShown");
    paper.classList.add("finalOut");

    await finalWait(750);

    paper.remove();
    hint.remove();

    showFinalSheet(stage);
}

function showFinalSheet(stage) {
    const sheet = document.createElement("div");
    sheet.id = "finalSheet";

    FINAL_LETTER_TEXT.forEach(function(text) {
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        sheet.appendChild(paragraph);
    });

    stage.appendChild(sheet);

    void sheet.offsetWidth;
    sheet.classList.add("finalIn");
}