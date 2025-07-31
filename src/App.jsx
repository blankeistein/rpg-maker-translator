import {
    Button,
    Card,
    IconButton,
    Select,
    Typography,
} from "@material-tailwind/react";
import Bottleneck from "bottleneck";
import clsx from "clsx";
import {
    BookAIcon,
    DownloadIcon,
    MoonIcon,
    PauseIcon,
    PlayIcon,
    SunIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast, { Toaster } from "react-hot-toast";
import CardJson from "./CardJson";
import languages from "./translator/languages";
import {
    extractTextsFromJson,
    setTextInJson,
    translateWithLingva,
} from "./translator/rpgm";

const STATE_PROCESS = {
    START: 0,
    RUNNING: 1,
    PAUSE: 2,
};

const toggleMode = () => {
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
};

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

export default function App() {
    const [containerJson, setContainerJson] = useState([]);
    const [darkMode, setDarkMode] = useState(false);
    const [stateProcess, setStateProcess] = useState(STATE_PROCESS.START);
    const [options, setOptions] = useState({
        source: "auto",
        target: "",
    });

    const onDrop = useCallback(async (acceptedFile) => {
        const files = await Promise.all(
            acceptedFile.map(async (file) => {
                const text = await readFileAsText(file);
                const json = JSON.parse(text);

                const extract = extractTextsFromJson(json);
                return {
                    textCount: extract.length,
                    file: file,
                };
            })
        );

        setContainerJson((prev) => [...prev, ...files]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/json": [".json"],
        },
    });

    const handleDarkMode = useCallback(() => {
        setDarkMode((prev) => !prev);
        toggleMode();
    }, [darkMode]);

    // Dark Mode
    useEffect(() => {
        if ("localStorage" in window) {
            const darkMode = window.localStorage.getItem("darkMode");
            if (darkMode) {
                document.documentElement.classList.add("dark");
                setDarkMode(true);
            } else {
                document.documentElement.classList.remove("dark");
                setDarkMode(false);
            }
        }
    }, []);

    const handleRemoveFile = useCallback((index) => {
        console.log(index);
        setContainerJson((prev) =>
            prev.filter((_, key) => {
                if (key === index) {
                    return false;
                }

                return true;
            })
        );
    }, []);

    const handleProcess = async () => {
        if (containerJson.length === 0) return;

        const { source, target } = options;

        if (!source) {
            toast.error("Choose source language");
            return;
        }

        if (!target) {
            toast.error("Choose target language");
            return;
        }

        setStateProcess(STATE_PROCESS.RUNNING);

        for (const [index, item] of containerJson.entries()) {
            const readFile = await readFileAsText(item.file);
            const json = JSON.parse(readFile);

            const texts = extractTextsFromJson(json);
            const translateQueue = new Bottleneck({
                maxConcurrent: 5,
                minTime: 500,
            });

            for (const text of texts) {
                translateQueue
                    .schedule(async () => {
                        const translatedText = await translateWithLingva(
                            text.text,
                            {
                                source,
                                target,
                            }
                        );
                        return translatedText;
                    })
                    .then((result) => {
                        setTextInJson(json, text.path, result);
                    })
                    .catch((error) => console.error(error));
            }

            translateQueue.on("done", function () {
                setTimeout(() => {
                    const stringJson = JSON.stringify(json);
                    const newFile = new File([stringJson], item.file.name, {
                        type: "application/json",
                    });
                    setContainerJson((prev) =>
                        prev.map((json, currentIndex) => {
                            if (currentIndex === index) {
                                return { ...json, translatedFile: newFile };
                            }

                            return json;
                        })
                    );
                }, 200);
            });
        }

        setStateProcess(STATE_PROCESS.START);
        toast.success("Success translated");
    };

    const sortedLanguages = useMemo(() => {
        return Object.entries(languages).sort((a, b) => {
            // console.log(a, b);
            return a[1].localeCompare(b[1]);
        });
    }, [languages]);

    const handleDownloadAll = useCallback(() => {
        const link = document.createElement("a");
        for (const json of containerJson) {
            if (!json.translatedFile) {
                continue;
            }
            link.href = URL.createObjectURL(json.translatedFile);
            link.download = json.translatedFile.name;
            link.click();
        }
    }, [containerJson]);

    return (
        <div className="w-full min-h-screen bg-background">
            <div className="fixed right-4 top-4">
                <IconButton variant="ghost" onClick={handleDarkMode}>
                    {darkMode ? (
                        <MoonIcon />
                    ) : (
                        <SunIcon className="text-warning" />
                    )}
                </IconButton>
            </div>
            <div className="px-4 py-10 mx-auto max-w-4xl w-full text-foreground">
                <Typography type="h1" className="mb-8 text-center !text-4xl">
                    RPG Maker JSON Translator
                </Typography>
                <Card>
                    <Card.Body className="p-6">
                        <Typography
                            type="h2"
                            className="font-semibold !text-2xl flex items-center gap-2 justify-center mb-5"
                        >
                            <BookAIcon className="size-5" />
                            Translator
                        </Typography>
                        <div className="flex flex-col gap-2">
                            <Typography
                                as="label"
                                htmlFor="inputJson"
                                className="font-semibold"
                            >
                                File JSON
                            </Typography>
                            <motion.div
                                whileTap={{ scale: 0.95 }}
                                className={clsx(
                                    "min-h-28 border-4 p-2 rounded-lg flex items-center justify-center cursor-pointer ",
                                    isDragActive
                                        ? "border-solid"
                                        : "border-dashed"
                                )}
                                {...getRootProps()}
                            >
                                <input id="inputJson" {...getInputProps()} />
                                {isDragActive ? (
                                    <p>Drop the files here ...</p>
                                ) : (
                                    <p>
                                        Drag &amp; drop some files here, or just
                                        click here
                                    </p>
                                )}
                            </motion.div>
                            {containerJson && (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 flex-wrap gap-2 max-h-64 overflow-auto">
                                    {containerJson.map((json, index) => (
                                        <CardJson
                                            key={index + json.file.name}
                                            index={index}
                                            filename={json.file.name}
                                            size={json.file.size}
                                            file={json.file}
                                            translatedFile={json.translatedFile}
                                            textCount={json.textCount}
                                            onDelete={handleRemoveFile}
                                        />
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                                <div className="w-full space-y-1">
                                    <Typography
                                        as="label"
                                        htmlFor="sourceLang"
                                        className="font-semibold"
                                    >
                                        Source
                                    </Typography>
                                    <Select
                                        value={options.source}
                                        onValueChange={(value) => {
                                            console.log(value);
                                            setOptions((prev) => ({
                                                ...prev,
                                                source: value,
                                            }));
                                        }}
                                    >
                                        <Select.Trigger
                                            id="sourceLang"
                                            placeholder="Choose Language"
                                        />
                                        <Select.List className="h-72 overflow-auto">
                                            <Select.Option value="auto">
                                                Auto Detect
                                            </Select.Option>
                                            {sortedLanguages.map(
                                                ([key, value]) => (
                                                    <Select.Option
                                                        key={key}
                                                        value={key}
                                                    >
                                                        {value}
                                                    </Select.Option>
                                                )
                                            )}
                                        </Select.List>
                                    </Select>
                                </div>
                                <div className="w-full space-y-1">
                                    <Typography
                                        as="label"
                                        htmlFor="targetLang"
                                        className="font-semibold"
                                    >
                                        Target
                                    </Typography>
                                    <Select
                                        value={options.target}
                                        onValueChange={(value) =>
                                            setOptions((prev) => ({
                                                ...prev,
                                                target: value,
                                            }))
                                        }
                                    >
                                        <Select.Trigger
                                            id="targetLang"
                                            placeholder="Choose Language"
                                        />
                                        <Select.List className="h-72 overflow-auto">
                                            {sortedLanguages.map(
                                                ([key, value]) => (
                                                    <Select.Option
                                                        key={key}
                                                        value={key}
                                                    >
                                                        {value}
                                                    </Select.Option>
                                                )
                                            )}
                                        </Select.List>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex justify-stretch items-center gap-2">
                                <Button
                                    className="grow"
                                    color={
                                        stateProcess === STATE_PROCESS.RUNNING
                                            ? "warning"
                                            : stateProcess ===
                                              STATE_PROCESS.PAUSE
                                            ? "success"
                                            : "info"
                                    }
                                    onClick={handleProcess}
                                    disabled={
                                        stateProcess === STATE_PROCESS.RUNNING
                                    }
                                >
                                    {stateProcess === STATE_PROCESS.RUNNING ? (
                                        <PauseIcon className="size-4 mr-1" />
                                    ) : (
                                        <PlayIcon className="size-4 mr-1" />
                                    )}
                                    {stateProcess === STATE_PROCESS.RUNNING
                                        ? "Pause"
                                        : stateProcess === STATE_PROCESS.PAUSE
                                        ? "Resume"
                                        : "Start"}
                                </Button>
                                <Button
                                    className="grow"
                                    disabled={containerJson.length === 0}
                                    onClick={handleDownloadAll}
                                >
                                    <DownloadIcon className="size-4 mr-1" />
                                    Download All
                                </Button>
                            </div>
                        </div>
                    </Card.Body>
                </Card>
            </div>
            <Toaster position="bottom-center" />
        </div>
    );
}
