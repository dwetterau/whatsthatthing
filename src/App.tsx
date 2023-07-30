import { useLayoutEffect, useRef, useState } from 'react';
import './App.css'
import { MapWrapper } from './Map'
import useResizeObserver from '@react-hook/resize-observer';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Authentication } from './Authentication';

const NAV_HEIGHT = 40;

export function App() {
    const containerRef = useRef<null | HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState<number>(300);

    useLayoutEffect(() => {
        if (containerRef.current === null) {
            return;
        }
        const {height} = containerRef.current.getBoundingClientRect();
        setContainerHeight(height);
    }, [containerRef])

    useResizeObserver(containerRef, (entry) => {
      const {height} = entry.contentRect;
      setContainerHeight(height);
    })

    return (
        <div style={{height: "100%"}} ref={containerRef}>
            <nav style={{
                height: NAV_HEIGHT, 
                width: "100vw",
                display: "flex",
                justifyContent: "space-between", 
            }}>
                <div>What's that thing?</div>
                <Authentication />
            </nav>
            <MapWrapper maxHeight={containerHeight - NAV_HEIGHT} />
        </div>
    )
}
