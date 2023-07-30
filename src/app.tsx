import { useLayoutEffect, useRef, useState } from "react";
import "./app.css";
import { MapWrapper } from "./map";
import useResizeObserver from "@react-hook/resize-observer";
import { Authentication } from "./authentication";
import { Authenticated } from "convex/react";
import { Achievements } from "./achievements";

const NAV_HEIGHT = 45;

export function App() {
    const containerRef = useRef<null | HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState<number>(300);

    useLayoutEffect(() => {
        if (containerRef.current === null) {
            return;
        }
        const { height } = containerRef.current.getBoundingClientRect();
        setContainerHeight(height);
    }, [containerRef]);

    useResizeObserver(containerRef, (entry) => {
        const { height } = entry.contentRect;
        setContainerHeight(height);
    });

    return (
        <div style={{ height: "100%" }} ref={containerRef}>
            <nav
                style={{
                    height: NAV_HEIGHT,
                    width: "100vw",
                    display: "flex",
                    justifyContent: "space-between",
                }}
            >
                <div
                    style={{
                        fontSize: 18,
                        fontWeight: 700,
                        padding: "0.5em",
                    }}
                >
                    What's that thing?
                </div>
                <Authenticated>
                    <Achievements />
                </Authenticated>
                <Authentication />
            </nav>
            <MapWrapper maxHeight={containerHeight - NAV_HEIGHT} />
        </div>
    );
}
