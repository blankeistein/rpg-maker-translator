/** @type {import('tailwindcss').Config} */
import { mtConfig } from "@material-tailwind/react";

export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./node_modules/@material-tailwind/react/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [mtConfig],
};
