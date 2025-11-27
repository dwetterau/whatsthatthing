/**
 * Static GTFS data loader for MTA
 * 
 * This module loads and parses static GTFS files needed for train position interpolation:
 * - stops.txt: Station locations (lat/lng)
 * - shapes.txt: Route geometry for interpolation
 * - stop_times.txt: Scheduled stop sequences
 * 
 * Static GTFS files can be downloaded from:
 * https://new.mta.info/developers
 */

export interface Stop {
    stopId: string;
    stopName: string;
    lat: number;
    lng: number;
}

export interface ShapePoint {
    shapeId: string;
    lat: number;
    lng: number;
    sequence: number;
}

export interface StopTime {
    tripId: string;
    arrivalTime: string;
    departureTime: string;
    stopId: string;
    stopSequence: number;
}

export interface StaticGTFSData {
    stops: Map<string, Stop>;
    shapes: Map<string, ShapePoint[]>; // shapeId -> ordered points
    stopTimes: Map<string, StopTime[]>; // tripId -> ordered stop times
}

/**
 * Parse CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

/**
 * Parse stops.txt CSV content
 */
function parseStops(csvContent: string): Map<string, Stop> {
    const stops = new Map<string, Stop>();
    const lines = csvContent.trim().split("\n");
    
    if (lines.length === 0) return stops;
    
    // Find header indices
    const header = parseCSVLine(lines[0]);
    const stopIdIdx = header.indexOf("stop_id");
    const stopNameIdx = header.indexOf("stop_name");
    const latIdx = header.indexOf("stop_lat");
    const lngIdx = header.indexOf("stop_lon");
    
    if (stopIdIdx === -1 || latIdx === -1 || lngIdx === -1) {
        throw new Error("Invalid stops.txt format: missing required columns");
    }
    
    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        if (fields.length <= Math.max(stopIdIdx, latIdx, lngIdx)) continue;
        
        const stopId = fields[stopIdIdx];
        const stopName = stopNameIdx >= 0 ? fields[stopNameIdx] : "";
        const lat = parseFloat(fields[latIdx]);
        const lng = parseFloat(fields[lngIdx]);
        
        if (!isNaN(lat) && !isNaN(lng)) {
            stops.set(stopId, {
                stopId,
                stopName,
                lat,
                lng,
            });
        }
    }
    
    return stops;
}

/**
 * Parse shapes.txt CSV content
 */
function parseShapes(csvContent: string): Map<string, ShapePoint[]> {
    const shapeMap = new Map<string, ShapePoint[]>();
    const lines = csvContent.trim().split("\n");
    
    if (lines.length === 0) return shapeMap;
    
    // Find header indices
    const header = parseCSVLine(lines[0]);
    const shapeIdIdx = header.indexOf("shape_id");
    const latIdx = header.indexOf("shape_pt_lat");
    const lngIdx = header.indexOf("shape_pt_lon");
    const sequenceIdx = header.indexOf("shape_pt_sequence");
    
    if (shapeIdIdx === -1 || latIdx === -1 || lngIdx === -1 || sequenceIdx === -1) {
        throw new Error("Invalid shapes.txt format: missing required columns");
    }
    
    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        if (fields.length <= Math.max(shapeIdIdx, latIdx, lngIdx, sequenceIdx)) continue;
        
        const shapeId = fields[shapeIdIdx];
        const lat = parseFloat(fields[latIdx]);
        const lng = parseFloat(fields[lngIdx]);
        const sequence = parseInt(fields[sequenceIdx], 10);
        
        if (!isNaN(lat) && !isNaN(lng) && !isNaN(sequence)) {
            if (!shapeMap.has(shapeId)) {
                shapeMap.set(shapeId, []);
            }
            shapeMap.get(shapeId)!.push({
                shapeId,
                lat,
                lng,
                sequence,
            });
        }
    }
    
    // Sort points by sequence for each shape
    for (const [shapeId, points] of shapeMap.entries()) {
        points.sort((a, b) => a.sequence - b.sequence);
    }
    
    return shapeMap;
}

/**
 * Parse stop_times.txt CSV content
 */
function parseStopTimes(csvContent: string): Map<string, StopTime[]> {
    const stopTimesMap = new Map<string, StopTime[]>();
    const lines = csvContent.trim().split("\n");
    
    if (lines.length === 0) return stopTimesMap;
    
    // Find header indices
    const header = parseCSVLine(lines[0]);
    const tripIdIdx = header.indexOf("trip_id");
    const arrivalTimeIdx = header.indexOf("arrival_time");
    const departureTimeIdx = header.indexOf("departure_time");
    const stopIdIdx = header.indexOf("stop_id");
    const stopSequenceIdx = header.indexOf("stop_sequence");
    
    if (tripIdIdx === -1 || arrivalTimeIdx === -1 || stopIdIdx === -1 || stopSequenceIdx === -1) {
        throw new Error("Invalid stop_times.txt format: missing required columns");
    }
    
    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        if (fields.length <= Math.max(tripIdIdx, arrivalTimeIdx, stopIdIdx, stopSequenceIdx)) continue;
        
        const tripId = fields[tripIdIdx];
        const arrivalTime = fields[arrivalTimeIdx];
        const departureTime = departureTimeIdx >= 0 ? fields[departureTimeIdx] : arrivalTime;
        const stopId = fields[stopIdIdx];
        const stopSequence = parseInt(fields[stopSequenceIdx], 10);
        
        if (!isNaN(stopSequence)) {
            if (!stopTimesMap.has(tripId)) {
                stopTimesMap.set(tripId, []);
            }
            stopTimesMap.get(tripId)!.push({
                tripId,
                arrivalTime,
                departureTime,
                stopId,
                stopSequence,
            });
        }
    }
    
    // Sort stop times by sequence for each trip
    for (const [tripId, stopTimes] of stopTimesMap.entries()) {
        stopTimes.sort((a, b) => a.stopSequence - b.stopSequence);
    }
    
    return stopTimesMap;
}

// Default MTA GTFS ZIP URL
const DEFAULT_GTFS_ZIP_URL = "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip";

/**
 * Download and extract GTFS ZIP file
 */
async function downloadAndExtractGTFSZip(
    extractDir: string,
): Promise<void> {
    const fs = await import("fs/promises");
    // @ts-ignore - adm-zip is CommonJS
    const AdmZipModule = await import("adm-zip");
    const AdmZip = AdmZipModule.default || AdmZipModule;
    
    console.log(`Downloading GTFS ZIP from ${DEFAULT_GTFS_ZIP_URL}...`);
    
    // Download the ZIP file
    const response = await fetch(DEFAULT_GTFS_ZIP_URL);
    if (!response.ok) {
        throw new Error(`Failed to download GTFS ZIP: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const zip = new AdmZip(Buffer.from(arrayBuffer));
    
    // Create extraction directory
    await fs.mkdir(extractDir, { recursive: true });
    
    // Extract all files
    zip.extractAllTo(extractDir, true);
    
    console.log(`Extracted GTFS files to ${extractDir}`);
}

/**
 * Check if all GTFS files exist
 */
async function checkFilesExist(
    stopsPath: string,
    shapesPath: string,
    stopTimesPath: string,
): Promise<boolean> {
    const fs = await import("fs/promises");
    const filesExist = await Promise.all([
        fs.access(stopsPath).then(() => true).catch(() => false),
        fs.access(shapesPath).then(() => true).catch(() => false),
        fs.access(stopTimesPath).then(() => true).catch(() => false),
    ]);
    return filesExist.every(exists => exists);
}

/**
 * Ensure GTFS files exist locally, downloading and extracting from ZIP if needed
 */
async function ensureGTFSFiles(
    stopsPath: string,
    shapesPath: string,
    stopTimesPath: string,
): Promise<void> {
    const path = await import("path");
    
    // Check if all required files exist
    if (await checkFilesExist(stopsPath, shapesPath, stopTimesPath)) {
        return;
    }
    
    // Some files are missing, download and extract from ZIP
    const extractDir = path.dirname(stopsPath);
    
    try {
        await downloadAndExtractGTFSZip(extractDir);
        
        // Verify files were extracted
        if (!(await checkFilesExist(stopsPath, shapesPath, stopTimesPath))) {
            const resolvedPath = path.resolve(stopsPath);
            throw new Error(
                `GTFS ZIP extraction incomplete. Missing files in ${path.dirname(resolvedPath)}. ` +
                `Please download static GTFS files from https://new.mta.info/developers ` +
                `and place them in ${path.dirname(resolvedPath)}.`
            );
        }
    } catch (error: any) {
        const resolvedPath = path.resolve(stopsPath);
        throw new Error(
            `GTFS files not found at ${resolvedPath} and failed to download: ${error.message}. ` +
            `Please download static GTFS files from https://new.mta.info/developers ` +
            `and place them in ${path.dirname(resolvedPath)}.`
        );
    }
}

/**
 * Load static GTFS data from file paths
 * 
 * If files don't exist locally, automatically downloads and extracts from MTA GTFS ZIP.
 * 
 * @param stopsPath File path to stops.txt
 * @param shapesPath File path to shapes.txt
 * @param stopTimesPath File path to stop_times.txt
 */
export async function loadStaticGTFS(
    stopsPath: string,
    shapesPath: string,
    stopTimesPath: string,
): Promise<StaticGTFSData> {
    const fs = await import("fs/promises");
    
    // Ensure files exist (download/extract if needed)
    await ensureGTFSFiles(stopsPath, shapesPath, stopTimesPath);
    
    // Read all files
    const [stopsContent, shapesContent, stopTimesContent] = await Promise.all([
        fs.readFile(stopsPath, "utf-8"),
        fs.readFile(shapesPath, "utf-8"),
        fs.readFile(stopTimesPath, "utf-8"),
    ]);
    
    return {
        stops: parseStops(stopsContent),
        shapes: parseShapes(shapesContent),
        stopTimes: parseStopTimes(stopTimesContent),
    };
}

/**
 * Convert GTFS time string (HH:MM:SS) to seconds since midnight
 */
export function timeToSeconds(timeStr: string): number {
    const parts = timeStr.split(":");
    if (parts.length !== 3) return 0;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return hours * 3600 + minutes * 60 + seconds;
}


