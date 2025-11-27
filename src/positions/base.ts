import type React from "react";
import type { DataSourceMessage, MessageType } from "../../data-sources/dataSource";

export interface Position {
    uniqueKey: string;
    lat: number;
    lng: number;
}

export interface PositionHandlerConfig<T extends Position, TMessageType extends MessageType = MessageType> {
    getMarkerSVG: (position: T) => string;
    renderPopup: (position: T) => React.ReactNode;
    getMessageType: () => TMessageType;
    parseMessage: (rawMsg: DataSourceMessage<TMessageType>) => Map<string, T> | null;
}

export abstract class PositionHandler<T extends Position, TMessageType extends MessageType = MessageType> {
    protected positions: Map<string, T> = new Map();
    protected config: PositionHandlerConfig<T, TMessageType>;

    constructor(config: PositionHandlerConfig<T, TMessageType>) {
        this.config = config;
    }

    /**
     * Handle a WebSocket message and update positions if applicable
     */
    handleMessage(rawMsg: DataSourceMessage<MessageType>): boolean {
        if (rawMsg.t !== this.config.getMessageType()) {
            return false;
        }

        // Type assertion is safe here because we've checked the message type matches
        const newPositions = this.config.parseMessage(rawMsg as DataSourceMessage<TMessageType>);
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

