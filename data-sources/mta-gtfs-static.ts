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

export interface Trip {
    tripId: string;
    routeId: string;
    serviceId: string;
    tripHeadsign: string;
    directionId: number;
    shapeId: string;
}

export interface Route {
    routeId: string;
    agencyId: string;
    routeShortName: string;
    routeLongName: string;
    routeDesc: string;
    routeType: number;
    routeUrl: string;
    routeColor: string;
    routeTextColor: string;
    routeSortOrder: number;
}

export interface StaticGTFSData {
    stops: Map<string, Stop>;
    shapes: Map<string, ShapePoint[]>; // shapeId -> ordered points
    stopTimes: Map<string, StopTime[]>; // tripId -> ordered stop times
    trips: Map<string, Trip>; // tripId -> Trip
    routes: Map<string, Route>; // routeId -> Route
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

/**
 * Parse trips.txt CSV content
 */
function parseTrips(csvContent: string): Map<string, Trip> {
    const tripsMap = new Map<string, Trip>();
    const lines = csvContent.trim().split("\n");
    
    if (lines.length === 0) return tripsMap;
    
    // Find header indices
    const header = parseCSVLine(lines[0]);
    const routeIdIdx = header.indexOf("route_id");
    const tripIdIdx = header.indexOf("trip_id");
    const serviceIdIdx = header.indexOf("service_id");
    const tripHeadsignIdx = header.indexOf("trip_headsign");
    const directionIdIdx = header.indexOf("direction_id");
    const shapeIdIdx = header.indexOf("shape_id");
    
    if (routeIdIdx === -1 || tripIdIdx === -1) {
        throw new Error("Invalid trips.txt format: missing required columns");
    }
    
    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        if (fields.length <= Math.max(routeIdIdx, tripIdIdx)) continue;
        
        const tripId = fields[tripIdIdx];
        // Normalize routeId: trim whitespace and remove quotes if present
        const routeId = fields[routeIdIdx] ? fields[routeIdIdx].trim().replace(/^["']|["']$/g, '') : "";
        const serviceId = serviceIdIdx >= 0 ? fields[serviceIdIdx] : "";
        const tripHeadsign = tripHeadsignIdx >= 0 ? fields[tripHeadsignIdx] : "";
        const directionId = directionIdIdx >= 0 ? parseInt(fields[directionIdIdx], 10) : 0;
        const shapeId = shapeIdIdx >= 0 ? fields[shapeIdIdx] : "";
        
        if (tripId && routeId) {
            tripsMap.set(tripId, {
                tripId,
                routeId,
                serviceId,
                tripHeadsign,
                directionId: isNaN(directionId) ? 0 : directionId,
                shapeId,
            });
        }
    }
    
    return tripsMap;
}

/**
 * Parse routes.txt CSV content
 */
function parseRoutes(csvContent: string): Map<string, Route> {
    const routesMap = new Map<string, Route>();
    const lines = csvContent.trim().split("\n");
    
    if (lines.length === 0) return routesMap;
    
    // Find header indices
    const header = parseCSVLine(lines[0]);
    const routeIdIdx = header.indexOf("route_id");
    const agencyIdIdx = header.indexOf("agency_id");
    const routeShortNameIdx = header.indexOf("route_short_name");
    const routeLongNameIdx = header.indexOf("route_long_name");
    const routeDescIdx = header.indexOf("route_desc");
    const routeTypeIdx = header.indexOf("route_type");
    const routeUrlIdx = header.indexOf("route_url");
    const routeColorIdx = header.indexOf("route_color");
    const routeTextColorIdx = header.indexOf("route_text_color");
    const routeSortOrderIdx = header.indexOf("route_sort_order");
    
    if (routeIdIdx === -1) {
        throw new Error("Invalid routes.txt format: missing required columns");
    }
    
    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        if (fields.length <= routeIdIdx) continue;
        
        // Normalize routeId: trim whitespace and remove quotes if present
        // Different GTFS sources use different formats (quoted vs unquoted, string vs number)
        const routeId = fields[routeIdIdx] ? fields[routeIdIdx].trim().replace(/^["']|["']$/g, '') : "";
        const agencyId = agencyIdIdx >= 0 ? fields[agencyIdIdx] : "";
        const routeShortName = routeShortNameIdx >= 0 ? fields[routeShortNameIdx] : "";
        const routeLongName = routeLongNameIdx >= 0 ? fields[routeLongNameIdx] : "";
        const routeDesc = routeDescIdx >= 0 ? fields[routeDescIdx] : "";
        const routeType = routeTypeIdx >= 0 ? parseInt(fields[routeTypeIdx], 10) : 0;
        const routeUrl = routeUrlIdx >= 0 ? fields[routeUrlIdx] : "";
        const routeColor = routeColorIdx >= 0 ? fields[routeColorIdx] : "";
        const routeTextColor = routeTextColorIdx >= 0 ? fields[routeTextColorIdx] : "";
        const routeSortOrder = routeSortOrderIdx >= 0 ? parseInt(fields[routeSortOrderIdx], 10) : 0;
        
        if (routeId) {
            routesMap.set(routeId, {
                routeId,
                agencyId,
                routeShortName,
                routeLongName,
                routeDesc,
                routeType: isNaN(routeType) ? 0 : routeType,
                routeUrl,
                routeColor,
                routeTextColor,
                routeSortOrder: isNaN(routeSortOrder) ? 0 : routeSortOrder,
            });
        }
    }
    
    return routesMap;
}

// MTA GTFS ZIP URLs by feed type
const GTFS_ZIP_URLS = {
    subway: "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip",
    lirr: "https://rrgtfsfeeds.s3.amazonaws.com/gtfslirr.zip",
    mnr: "https://rrgtfsfeeds.s3.amazonaws.com/gtfsmnr.zip",
} as const;

/**
 * Download and extract GTFS ZIP file
 */
async function downloadAndExtractGTFSZip(
    zipUrl: string,
    extractDir: string,
): Promise<void> {
    const fs = await import("fs/promises");
    // @ts-ignore - adm-zip is CommonJS
    const AdmZipModule = await import("adm-zip");
    const AdmZip = AdmZipModule.default || AdmZipModule;
    
    console.log(`Downloading GTFS ZIP from ${zipUrl}...`);
    
    // Download the ZIP file
    const response = await fetch(zipUrl);
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
    tripsPath: string,
    routesPath: string,
): Promise<boolean> {
    const fs = await import("fs/promises");
    const filesExist = await Promise.all([
        fs.access(stopsPath).then(() => true).catch(() => false),
        fs.access(shapesPath).then(() => true).catch(() => false),
        fs.access(stopTimesPath).then(() => true).catch(() => false),
        fs.access(tripsPath).then(() => true).catch(() => false),
        fs.access(routesPath).then(() => true).catch(() => false),
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
    tripsPath: string,
    routesPath: string,
    zipUrl: string,
): Promise<void> {
    const path = await import("path");
    
    // Check if all required files exist
    if (await checkFilesExist(stopsPath, shapesPath, stopTimesPath, tripsPath, routesPath)) {
        return;
    }
    
    // Some files are missing, download and extract from ZIP
    const extractDir = path.dirname(stopsPath);
    
    try {
        await downloadAndExtractGTFSZip(zipUrl, extractDir);
        
        // Verify files were extracted
        if (!(await checkFilesExist(stopsPath, shapesPath, stopTimesPath, tripsPath, routesPath))) {
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
 * Load static GTFS data for a specific feed type
 * 
 * If files don't exist locally, automatically downloads and extracts from MTA GTFS ZIP.
 * Files are organized in subdirectories: mta-gtfs-static/{feedType}/
 * 
 * @param feedType Type of feed: "subway", "lirr", or "mnr"
 */
export async function loadStaticGTFS(
    feedType: "subway" | "lirr" | "mnr",
): Promise<StaticGTFSData> {
    const fs = await import("fs/promises");
    const path = await import("path");
    
    // Determine paths based on feed type
    const baseDir = path.join("./mta-gtfs-static", feedType);
    const stopsPath = path.join(baseDir, "stops.txt");
    const shapesPath = path.join(baseDir, "shapes.txt");
    const stopTimesPath = path.join(baseDir, "stop_times.txt");
    const tripsPath = path.join(baseDir, "trips.txt");
    const routesPath = path.join(baseDir, "routes.txt");
    
    // Get the appropriate ZIP URL
    const zipUrl = GTFS_ZIP_URLS[feedType];
    
    // Ensure files exist (download/extract if needed)
    await ensureGTFSFiles(stopsPath, shapesPath, stopTimesPath, tripsPath, routesPath, zipUrl);
    
    // Read all files
    const [stopsContent, shapesContent, stopTimesContent, tripsContent, routesContent] = await Promise.all([
        fs.readFile(stopsPath, "utf-8"),
        fs.readFile(shapesPath, "utf-8"),
        fs.readFile(stopTimesPath, "utf-8"),
        fs.readFile(tripsPath, "utf-8"),
        fs.readFile(routesPath, "utf-8"),
    ]);
    
    return {
        stops: parseStops(stopsContent),
        shapes: parseShapes(shapesContent),
        stopTimes: parseStopTimes(stopTimesContent),
        trips: parseTrips(tripsContent),
        routes: parseRoutes(routesContent),
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


