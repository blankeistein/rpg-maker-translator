const TRANSLATABLE_COMMANDS = [101, 401, 102, 402, 105, 405, 120, 121];
const PROTECTED_COMMANDS = [356, 357, 358, 250, 251];
let ENDPOINTS = [
    "https://lingva.lunar.icu/api/v1",
    "https://lingva.ml/api/v1",
    "https://translate.plausibility.cloud/api/v1",
];

async function processLingvaTranslation() {
    try {
        const translatedText = await translateWithLingva(currentItem.text);
        if (translatedText && setTextInJson(currentItem.path, translatedText)) {
            const logObject = {
                original: currentItem.text,
                translated: translatedText,
            };
            addLog(logObject, "success");
            translatedCount++;
        } else {
            translationQueue.unshift(currentItem);
            translationErrors++;
            addLog('Failed to translate: "' + currentItem.text + '"', "error");
        }
    } catch (error) {
        console.error("Lingva translation error:", error);
        translationQueue.unshift(currentItem);
        translationErrors++;
        addLog("Translation failed: " + error.message, "error");
        currentLingvaEndpoint =
            (currentLingvaEndpoint + 1) % lingvaEndpoints.length;
        addLog(
            "Switching to Lingva endpoint: " +
                lingvaEndpoints[currentLingvaEndpoint],
            "warning"
        );
    }
    updateProgress();
    setTimeout(processLingvaTranslation, 500);
}

async function translateWithLingva(
    textToTranslate,
    { source = "auto", target }
) {
    if (!textToTranslate || typeof textToTranslate !== "string") {
        throw new Error(
            "Invalid text to translate: input must be a non-empty string."
        );
    }

    if (!target) {
        throw new Error(
            "Invalid target language: target language must be specified."
        );
    }

    try {
        const { protectedText, codes } = protectRpgMakerCodes(textToTranslate);
        let lastError = null;

        for (const endpoint of ENDPOINTS) {
            try {
                const apiUrl =
                    endpoint +
                    "/" +
                    source +
                    "/" +
                    target +
                    "/" +
                    encodeURIComponent(protectedText);

                const response = await fetch(apiUrl);
                if (!response.ok) {
                    // Jika respons tidak OK (misal 404, 500), anggap ini error dan coba endpoint lain
                    const errorDetail = response.statusText || "Unknown status";
                    throw new Error(
                        `Endpoint ${endpoint} failed with status: ${response.status} (${errorDetail})`
                    );
                }

                const apiData = await response.json();
                if (!apiData || !apiData.translation) {
                    throw new Error(
                        `Invalid response format from endpoint ${endpoint}: missing translation data.`
                    );
                }

                let translatedText = apiData.translation.trim();
                translatedText = restoreRpgMakerCodes(translatedText, codes);
                translatedText = translatedText.replace(/\s+/g, " ").trim();
                return translatedText;
            } catch (error) {
                console.error(
                    `❌ failed endpoint ${endpoint}: ${error.message}`
                );
                lastError = error;
            }
        }

        throw new Error(
            "Failed to connect to any available Lingva translation service.",
            { cause: lastError }
        );
    } catch (error) {
        console.error("Lingva translation failed:", error);
        throw new Error("Lingva translation failed: " + error.message);
    }
}

function extractTextsFromJson(currentObject, currentPath = []) {
    let foundTexts = [];
    if (currentObject === null || typeof currentObject !== "object") {
        return foundTexts;
    }
    for (const key in currentObject) {
        if (!currentObject.hasOwnProperty(key)) {
            continue;
        }
        const value = [...currentPath, key];
        const newPath = currentObject[key];
        if (key === "code" && currentPath[currentPath.length - 1] === "list") {
            if (currentObject.parameters && !shouldTranslateCommand(newPath)) {
                continue;
            }
        }
        if (typeof newPath === "string") {
            if (shouldSkipText(newPath, key, value)) {
                continue;
            }
            if (isLikelyText(newPath)) {
                const textInfo = {
                    path: value,
                    text: newPath,
                    fieldName: key,
                };
                foundTexts.push(textInfo);
            }
        } else {
            if (Array.isArray(newPath)) {
                newPath.forEach((item, key) => {
                    if (typeof item === "string") {
                        if (key === "parameters" && currentPath.length > 0) {
                            if (
                                currentObject.code &&
                                !shouldTranslateCommand(currentObject.code)
                            ) {
                                return;
                            }
                        }
                        if (
                            !shouldSkipText(
                                item,
                                "parameters[" + key + "]",
                                value
                            ) &&
                            isLikelyText(item)
                        ) {
                            const textInfo = {
                                path: [...value, key],
                                text: item,
                                fieldName: "parameters[" + key + "]",
                            };
                            foundTexts.push(textInfo);
                        }
                    } else {
                        if (typeof item === "object" && item !== null) {
                            foundTexts = foundTexts.concat(
                                extractTextsFromJson(item, [...value, key])
                            );
                        }
                    }
                });
            } else if (typeof newPath === "object" && newPath !== null) {
                foundTexts = foundTexts.concat(
                    extractTextsFromJson(newPath, value)
                );
            }
        }
    }
    return foundTexts;
}

function shouldTranslateCommand(commandCode) {
    if (typeof commandCode !== "number") {
        return false;
    }
    if (PROTECTED_COMMANDS.includes(commandCode)) {
        return false;
    }
    return TRANSLATABLE_COMMANDS.includes(commandCode);
}

function shouldSkipText(text, fieldName, path) {
    if (fieldName === "parameters" || path.includes("parameters")) {
        const commandCode = getCommandCodeFromPath(path);
        if (commandCode !== null && !shouldTranslateCommand(commandCode)) {
            return true;
        }
    }
    const skippedFieldNames = [
        "code",
        "indent",
        "name",
        "characterName",
        "id",
        "note",
        "meta",
        "displayName",
    ];
    if (skippedFieldNames.includes(fieldName)) {
        return true;
    }
    const skippedTextPatterns = [
        /^[!$\\][a-zA-Z0-9_\-\[\]]+$/,
        /^[a-zA-Z0-9_$!\-]+$/,
        /^\$[a-zA-Z0-9_\-]+$/,
        /^![a-zA-Z0-9_\-]+$/,
        /^\\[A-Za-z]\[[0-9]+\]$/,
    ];
    if (skippedTextPatterns.some((pattern) => pattern.test(text))) {
        return true;
    }
    return false;
}

function getCommandCodeFromPath(path) {
    try {
        let currentNode = workingJson;
        for (const pathSegment of path) {
            if (pathSegment === "parameters") {
                break;
            }
            currentNode = currentNode[pathSegment];
            if (!currentNode) {
                return null;
            }
        }
        if (currentNode && typeof currentNode.code === "number") {
            return currentNode.code;
        }
        return null;
    } catch (error) {
        return null;
    }
}

function isLikelyText(text) {
    if (!text.trim()) {
        return false;
    }
    if (!isNaN(text)) {
        return false;
    }
    if (text === text.toUpperCase() && !/[a-z]/.test(text)) {
        return false;
    }
    if (/^[!$\\][a-zA-Z0-9_\-\[\]]+$/.test(text)) {
        return false;
    }
    const likelyTextPatterns = [
        /[\s.!?,;:'"()\-]/,
        /[\u3000-\u9FFF]/,
        /[a-z][A-Z][0-9]/,
    ];
    return likelyTextPatterns.some((_0x5cbcfb) => _0x5cbcfb.test(text));
}

function protectRpgMakerCodes(inputText) {
    const rpgCodePattern =
        /(\\[A-Za-z<>](\[[0-9]+\])?|\\[#@$!<>][A-Za-z0-9_]*|\\[CN]\[[0-9]+\]|\$[A-Za-z0-9_]+|![A-Za-z0-9_\-]+|\?{3,}|[!$\\<>][^ \n\r\t]+)/gi;
    window.rpgmCodes = window.rpgmCodes || [];
    window.rpgmCodeIndex = window.rpgmCodeIndex || 0;
    let protectedText = inputText.replace(rpgCodePattern, (matchedCode) => {
        if (/RPGM[_\s]*CODE[_\s]*\d+/i.test(matchedCode)) {
            return matchedCode;
        }
        window.rpgmCodes[window.rpgmCodeIndex] = matchedCode;
        const placeholder = " RPGM_CODE_" + window.rpgmCodeIndex + "_ ";
        window.rpgmCodeIndex++;
        return placeholder;
    });

    return {
        protectedText: protectedText,
        codes: window.rpgmCodes,
    };
}

function restoreRpgMakerCodes(inputText, codeMap) {
    if (typeof inputText !== "string") {
        return inputText;
    }
    try {
        let processedText = inputText;

        const placeholderPatterns = [
            /RPGM[_\s]*CODE[_\s]*(\d+)[_\s]*/gi,
            /RPG[_\s]*CODE[_\s]*(\d+)[_\s]*/gi,
            /CODE[_\s]*(\d+)[_\s]*/gi,
            /RPGM[_\s]*(\d+)[_\s]*/gi,
            /\[CODE[_\s]*(\d+)[_\s]*\]/gi,
        ];

        for (const pattern of placeholderPatterns) {
            processedText = processedText.replace(
                pattern,
                (fullMatch, codeId) => {
                    const codeIndex = parseInt(codeId);
                    return codeMap[codeIndex] || fullMatch;
                }
            );
        }
        processedText = processedText.replace(
            /\s*(\\[A-Za-z]\[[0-9]+\])\s*/g,
            "$1"
        );
        processedText = processedText.replace(
            /\s*(\\[CN]\[[0-9]+\])\s*/g,
            "$1"
        );
        processedText = processedText.replace(
            /\s*([!$\\][A-Za-z0-9_\-]+)\s*/g,
            "$1"
        );
        processedText = processedText.replace(/\s*\?\s*\?\s*\?\s*/g, "???");
        processedText = processedText.replace(
            /rpm_protect_\d+_/gi,
            (substring) => {
                const _0x3226b2 = substring.match(/\d+/);
                if (_0x3226b2) {
                    const codeIndex = parseInt(_0x3226b2[0]);
                    return codeMap[codeIndex] || substring;
                }
                return substring;
            }
        );
        return processedText;
    } catch (error) {
        console.error("Error in restoreRpgMakerCodes:", error);
        return inputText;
    }
}

function setTextInJson(data, path, newText) {
    let parentNode = data;
    try {
        for (let i = 0; i < path.length - 1; i++) {
            const segment = path[i];
            if (
                typeof segment === "string" &&
                segment.includes &&
                segment.includes("[")
            ) {
                const key = segment.split("[")[0];
                const index = parseInt(segment.split("[")[1].split("]")[0]);
                if (!parentNode[key] || !parentNode[key][index]) {
                    return false;
                }
                parentNode = parentNode[key][index];
            } else {
                if (!parentNode[segment]) {
                    return false;
                }
                parentNode = parentNode[segment];
            }
        }
        const lastKey = path[path.length - 1];
        if (
            typeof lastKey === "string" &&
            lastKey.includes &&
            lastKey.includes("[")
        ) {
            const key = lastKey.split("[")[0];
            const index = parseInt(lastKey.split("[")[1].split("]")[0]);
            if (!parentNode[key]) {
                return false;
            }
            parentNode[key][index] = newText;
        } else {
            parentNode[lastKey] = newText;
        }
        return true;
    } catch (error) {
        console.error("Error in setTextInJson:", error);
        return false;
    }
}

export {
    extractTextsFromJson,
    shouldTranslateCommand,
    shouldSkipText,
    getCommandCodeFromPath,
    protectRpgMakerCodes,
    restoreRpgMakerCodes,
    translateWithLingva,
    setTextInJson,
    TRANSLATABLE_COMMANDS,
    PROTECTED_COMMANDS,
};
