import { Card, IconButton, Typography } from "@material-tailwind/react";
import { DownloadIcon, FileJson, XCircleIcon } from "lucide-react";
import { memo } from "react";
import { bytesToKB } from "./utils";

const CardJson = memo(function ({
    index,
    filename,
    file,
    size,
    textCount,
    translateFile,
    onDelete,
}) {
    const handleRemoveFile = () => {
        onDelete(index);
    };

    return (
        <Card className="relative flex flex-col min-h-[240px]">
            <Card.Header className="flex flex-col grow">
                <div className="flex justify-end gap-1 mb-1">
                    <IconButton variant="ghost" disabled>
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
            {/* <Card.Footer>
                                              <Progress
                                                  color="primary"
                                                  value={50}
                                              >
                                                  <Progress.Bar className="flex items-center justify-center">
                                                      <Typography
                                                          type="small"
                                                          color="secondary"
                                                      >
                                                          50%
                                                      </Typography>
                                                  </Progress.Bar>
                                              </Progress>
                                          </Card.Footer> */}
        </Card>
    );
});

export default CardJson;
