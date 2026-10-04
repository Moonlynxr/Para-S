let keys = 0;

function addKey() {
    keys++;
}

function useKey() {
    if (keys <= 0) {
        return false;
    }

    keys--;

    return true;
}

function getKeys() {
    return keys;
}