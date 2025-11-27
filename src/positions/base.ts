import type React from "react";

export interface Position {
    uniqueKey: string;
    lat: number;
    lng: number;
}

export interface PositionHandlerConfig<T extends Position> {
    getMarkerSVG: (position: T) => string;
    renderPopup: (position: T) => React.ReactNode;
    getMessageType: () => string;
    parseMessage: (rawMsg: any) => Map<string, T> | null;
}

export abstract class PositionHandler<T extends Position> {
    protected positions: Map<string, T> = new Map();
    protected config: PositionHandlerConfig<T>;

    constructor(config: PositionHandlerConfig<T>) {
        this.config = config;
    }

    /**
     * Handle a WebSocket message and update positions if applicable
     */
    handleMessage(rawMsg: any): boolean {
        if (rawMsg.t !== this.config.getMessageType()) {
            return false;
        }

        const newPositions = this.config.parseMessage(rawMsg);
        if (newPositions !== null) {
            this.updatePositions(newPositions);
            return true;
        }
        return false;
    }

    /**
     * Update positions with new data
     */
    updatePositions(newPositions: Map<string, T>): void {
        this.positions = newPositions;
    }

    /**
     * Get current positions
     */
    getPositions(): Map<string, T> {
        return this.positions;
    }
}

