function bytesToKB(bytes) {
    if (typeof bytes !== "number" || bytes < 0) {
        return "Input tidak valid";
    }

    const kb = bytes / 1024;
    return kb.toFixed(2);
}

export { bytesToKB };
