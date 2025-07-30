import { useState } from "react";

export default function useDownload() {
    const [endpointIndex, setEnpointIndex] = useState(0);

    return { download, progress, setData, data };
}
