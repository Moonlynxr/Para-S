const emptyChestMessages = [
    "¡Oh no! Este cofre está vacío",
    "¡Vaya! No hay nada aquí",
    "¡Qué decepción! Este cofre no tiene nada.",
    "Nop :3",
    "Casi... creo.",
    "Segura que este era?",
    "Este tampoco tenía nada XD.",
    "Bueno... definitivamente no era este."
];

function getEmptyChestMessage(index) {
    if (index < 0 || index >= emptyChestMessages.length) {
        return "Parece que hubo un error...";
    }

    return emptyChestMessages[index];
}