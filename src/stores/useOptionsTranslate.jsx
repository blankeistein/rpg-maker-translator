import { create } from "zustand";
const useOptionsTranslate = create((set) => ({
    source: "auto",
    target: "",
    setSource: (source) => set({ source: source }),
    setTarget: (target) => set({ target: target }),
}));

export default useOptionsTranslate;
