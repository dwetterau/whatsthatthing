/**
 * Train position interpolation logic for MTA GTFS-RT data
 * 
 * Since MTA provides arrival predictions (not GPS), we interpolate train positions
 * between stations based on predicted arrival times and route geometry.
 */

import type { ShapePoint, Stop, StaticGTFSData } from "./mta-gtfs-static";

export interface InterpolatedPosition {
    lat: number;
    lng: number;
    progress: number; // 0-1, where 0 is at last stop, 1 is at next stop
}

/**
 * Calculate distance between two lat/lng points (Haversine formula)
 */
function distance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Find the closest point on a shape to a given lat/lng
 */
function findClosestPointOnShape(
    shape: ShapePoint[],
    lat: number,
    lng: number,
): { point: ShapePoint; index: number; distance: number } {
    let closest = shape[0];
    let closestIndex = 0;
    let minDistance = distance(lat, lng, shape[0].lat, shape[0].lng);
    
    for (let i = 1; i < shape.length; i++) {
        const dist = distance(lat, lng, shape[i].lat, shape[i].lng);
        if (dist < minDistance) {
            minDistance = dist;
            closest = shape[i];
            closestIndex = i;
        }
    }
    
    return { point: closest, index: closestIndex, distance: minDistance };
}

/**
 * Interpolate position along a shape between two indices
 */
function interpolateAlongShape(
    shape: ShapePoint[],
    startIndex: number,
    endIndex: number,
    progress: number,
): { lat: number; lng: number } {
    if (startIndex === endIndex) {
        return { lat: shape[startIndex].lat, lng: shape[startIndex].lng };
    }
    
    // Calculate total distance along shape
    let totalDistance = 0;
    const segmentDistances: number[] = [0];
    
    for (let i = startIndex; i < endIndex; i++) {
        const dist = distance(
            shape[i].lat,
            shape[i].lng,
            shape[i + 1].lat,
            shape[i + 1].lng,
        );
        totalDistance += dist;
        segmentDistances.push(totalDistance);
    }
    
    if (totalDistance === 0) {
        return { lat: shape[startIndex].lat, lng: shape[startIndex].lng };
    }
    
    // Find which segment we're in
    const targetDistance = progress * totalDistance;
    let segmentIndex = 0;
    for (let i = 0; i < segmentDistances.length - 1; i++) {
        if (
            targetDistance >= segmentDistances[i] &&
            targetDistance <= segmentDistances[i + 1]
        ) {
            segmentIndex = i;
            break;
        }
    }
    
    // Interpolate within the segment
    const segmentStart = segmentDistances[segmentIndex];
    const segmentEnd = segmentDistances[segmentIndex + 1];
    const segmentProgress =
        segmentEnd > segmentStart
            ? (targetDistance - segmentStart) / (segmentEnd - segmentStart)
            : 0;
    
    const p1 = shape[startIndex + segmentIndex];
    const p2 = shape[startIndex + segmentIndex + 1];
    
    return {
        lat: p1.lat + (p2.lat - p1.lat) * segmentProgress,
        lng: p1.lng + (p2.lng - p1.lng) * segmentProgress,
    };
}

/**
 * Interpolate train position between two stops based on predicted arrival times
 * 
 * @param lastStop The stop the train just passed/departed
 * @param nextStop The next stop the train is heading to
 * @param lastStopTime Predicted departure/arrival time at last stop (Unix timestamp in seconds)
 * @param nextStopTime Predicted arrival time at next stop (Unix timestamp in seconds)
 * @param currentTime Current time (Unix timestamp in seconds)
 * @param staticData Static GTFS data containing shapes and stops
 * @param shapeId Optional shape ID to use for interpolation. If not provided, uses straight line.
 */
export function interpolateTrainPosition(
    lastStop: Stop,
    nextStop: Stop,
    lastStopTime: number,
    nextStopTime: number,
    currentTime: number,
    staticData: StaticGTFSData,
    shapeId?: string,
): InterpolatedPosition | null {
    // Clamp current time between last and next stop times
    const clampedTime = Math.max(lastStopTime, Math.min(currentTime, nextStopTime));
    
    // Calculate progress (0 = at last stop, 1 = at next stop)
    const timeRange = nextStopTime - lastStopTime;
    if (timeRange <= 0) {
        // Train is at or past next stop
        return {
            lat: nextStop.lat,
            lng: nextStop.lng,
            progress: 1,
        };
    }
    
    const progress = (clampedTime - lastStopTime) / timeRange;
    
    // If we have a shape, interpolate along it
    if (shapeId && staticData.shapes.has(shapeId)) {
        const shape = staticData.shapes.get(shapeId)!;
        
        // Find closest points on shape to last and next stops
        const lastStopOnShape = findClosestPointOnShape(
            shape,
            lastStop.lat,
            lastStop.lng,
        );
        const nextStopOnShape = findClosestPointOnShape(
            shape,
            nextStop.lat,
            nextStop.lng,
        );
        
        // Determine direction along shape
        let startIndex = lastStopOnShape.index;
        let endIndex = nextStopOnShape.index;
        
        // If next stop is before last stop in sequence, reverse
        if (endIndex < startIndex) {
            [startIndex, endIndex] = [endIndex, startIndex];
        }
        
        // Interpolate along shape
        const position = interpolateAlongShape(shape, startIndex, endIndex, progress);
        
        return {
            lat: position.lat,
            lng: position.lng,
            progress,
        };
    }
    
    // Fallback: linear interpolation between stops
    return {
        lat: lastStop.lat + (nextStop.lat - lastStop.lat) * progress,
        lng: lastStop.lng + (nextStop.lng - lastStop.lng) * progress,
        progress,
    };
}

/**
 * Find the shape ID for a trip by matching stops to shape points
 */
export function findShapeForTrip(
    tripId: string,
    staticData: StaticGTFSData,
): string | null {
    const stopTimes = staticData.stopTimes.get(tripId);
    if (!stopTimes || stopTimes.length === 0) {
        return null;
    }
    
    // Try to find a shape that matches the stop sequence
    // This is a simplified approach - in practice, you'd match via trips.txt -> routes.txt -> shapes.txt
    for (const [shapeId, shapePoints] of staticData.shapes.entries()) {
        // Check if first and last stops of trip are close to shape endpoints
        const firstStop = staticData.stops.get(stopTimes[0].stopId);
        const lastStop = staticData.stops.get(stopTimes[stopTimes.length - 1].stopId);
        
        if (firstStop && lastStop) {
            const firstShapePoint = shapePoints[0];
            const lastShapePoint = shapePoints[shapePoints.length - 1];
            
            const distToFirst = distance(
                firstStop.lat,
                firstStop.lng,
                firstShapePoint.lat,
                firstShapePoint.lng,
            );
            const distToLast = distance(
                lastStop.lat,
                lastStop.lng,
                lastShapePoint.lat,
                lastShapePoint.lng,
            );
            
            // If both endpoints are within 500m, assume this is the right shape
            if (distToFirst < 500 && distToLast < 500) {
                return shapeId;
            }
        }
    }
    
    return null;
}

