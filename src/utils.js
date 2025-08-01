function toggleMode() {
    if ("localStorage" in window) {
        if (document.documentElement.classList.contains("dark")) {
            window.localStorage.removeItem("darkMode");
        } else {
            window.localStorage.setItem("darkMode", true);
        }
    } else {
        alert("Tema tidak bisa disimpan, karena browser anda tidak mendukung");
    }
    document.documentElement.classList.toggle("dark");
}

function bytesToKB(bytes) {
    if (typeof bytes !== "number" || bytes < 0) {
        return "Input tidak valid";
    }

    const kb = bytes / 1024;
    return kb.toFixed(2);
}

/**
 *
 * @param {Blob} file
 */
function readFileAsText(file) {
    return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                res(event.target.result);
            } catch (e) {
                rej(e.message);
            }
        };
        reader.readAsText(file);
    });
}

export { bytesToKB, readFileAsText, toggleMode };
