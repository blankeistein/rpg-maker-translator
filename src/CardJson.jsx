import {
    Card,
    IconButton,
    Progress,
    Typography,
} from "@material-tailwind/react";
import Bottleneck from "bottleneck";
import { DownloadIcon, FileJson, Languages, XCircleIcon } from "lucide-react";
import { memo, useMemo, useRef, useState } from "react";
import useOptionsTranslate from "./stores/useOptionsTranslate";
import {
    extractTextsFromJson,
    setTextInJson,
    translateWithLingva,
} from "./translator/rpgm";
import { bytesToKB, readFileAsText } from "./utils";

const MAX_CONCURRENT = 5;

const CardJson = memo(function ({
    index,
    filename,
    file,
    size,
    textCount,
    translatedFile,
    download,
    onUpdate,
    onDelete,
}) {
    const { source, target } = useOptionsTranslate();

    const [state, setState] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const translateTextQueue = useRef(
        new Bottleneck({
            maxConcurrent: MAX_CONCURRENT,
            minTime: 100,
        })
    );
    const handleRemoveFile = () => {
        onDelete(index);
    };

    const handleDownload = () => {
        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(translatedFile);
        downloadLink.download = translatedFile.name;
        downloadLink.click();
    };

    const translateProcess = async () => {
        setState(true);
        const readFile = await readFileAsText(file);
        const json = JSON.parse(readFile);

        const texts = extractTextsFromJson(json);

        let count = 0;
        for (const text of texts) {
            translateTextQueue.current
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
                    count++;
                    setTextInJson(json, text.path, result);
                    setDownloadProgress((prev) => prev + 1);
                })
                .catch((error) => console.error(error));
        }
        let intervalId;

        intervalId = setInterval(() => {
            if (translateTextQueue.current.empty()) {
                const stringJson = JSON.stringify(json);
                const newFile = new File([stringJson], file.name, {
                    type: "application/json",
                });
                onUpdate(index, {
                    translatedFile: newFile,
                });

                setState(false);
                console.log("Done");

                clearInterval(intervalId);
            }
        }, 1000);
    };

    const percentage = useMemo(() => {
        return Math.round((downloadProgress / textCount) * 100);
    }, [downloadProgress]);

    return (
        <Card className="relative flex flex-col min-h-[240px]">
            <Card.Header className="flex flex-col grow">
                <div className="flex justify-end gap-1 mb-1">
                    {!translatedFile && (
                        <IconButton
                            variant="ghost"
                            onClick={translateProcess}
                            disabled={state}
                        >
                            <Languages className="text-info" />
                        </IconButton>
                    )}
                    <IconButton
                        variant="ghost"
                        disabled={Boolean(!translatedFile)}
                        onClick={handleDownload}
                    >
                        <DownloadIcon className="text-success" />
                    </IconButton>
                    <IconButton variant="ghost" onClick={handleRemoveFile}>
                        <XCircleIcon className="text-error" />
                    </IconButton>
                </div>
                <FileJson className="size-24 grow mx-auto" />
            </Card.Header>
            <Card.Body>
                <Typography type="p" className="line-clamp-2 font-semibold">
                    {filename}
                </Typography>
                <Typography type="small">Total text: {textCount}</Typography>
                <br />
                <Typography type="small">Size: {bytesToKB(size)} KB</Typography>
            </Card.Body>
            {(state || downloadProgress > 0) && (
                <Card.Footer>
                    <Progress color="primary" value={percentage}>
                        <Progress.Bar className="flex items-center justify-center">
                            <Typography type="small" color="secondary">
                                {percentage}%
                            </Typography>
                        </Progress.Bar>
                    </Progress>
                </Card.Footer>
            )}
        </Card>
    );
});

export default CardJson;
