import { mockActivities } from './config.js';
import { loadAuthData, updateStravaButtonState, fetchActivities, getAuthData, decodePolyline, centroid, project, fit, drawMap } from './strava.js';
import {
    domElements,
    populateActivitiesSelect,
    updateOverlay,
    loadImageFromFile,
    setInitialImage,
    resetOverlayPosition,
    pointerDown,
    pointerMove,
    pointerUp,
    capture,
    setLoadingState // Import setLoadingState if needed directly here, though likely used within strava/ui
} from './ui.js';

// --- State ---
let currentActivities = [];
let selectedActivity = mockActivities[0]; // Default to first mock activity

// --- Functions ---

/**
 * Processes and draws the map polyline for the given activity onto the canvas.
 * Hides the canvas if no map data is available.
 * @param {object | null} activity The activity object, or null.
 */
function drawActivityMap(activity) {
    const canvasElement = domElements.activityMapCanvas; // Get canvas from domElements
    if (!canvasElement) {
        console.error("Map canvas element not found in domElements.");
        return;
    }

    const mapData = activity?.map?.summary_polyline; // Use optional chaining

    if (mapData) {
        try {
            const decodedCoords = decodePolyline(mapData);
            if (decodedCoords.length > 0) {
                const center = centroid([decodedCoords]);
                const projectedCoords = project(decodedCoords, center);
                // Use canvasElement.width for size, assuming it's set correctly (e.g., 200)
                const fittedCoords = fit([projectedCoords], canvasElement.width);
                drawMap(canvasElement, fittedCoords, canvasElement.width); // Call imported drawMap
            } else {
                // Handle case where polyline is present but empty/invalid
                console.warn("Activity has empty or invalid polyline data.");
                drawMap(canvasElement, [], canvasElement.width); // Hide the canvas
            }
        } catch (error) {
            console.error("Error processing map polyline:", error);
            drawMap(canvasElement, [], canvasElement.width); // Hide canvas on error
        }
    } else {
        // No map data, ensure canvas is hidden
        drawMap(canvasElement, [], canvasElement.width); // Hide the canvas
    }
}

function handleActivitySelectionChange(e) {
    const selectedOption = e.target.selectedOptions[0];
    const selectedIndex = selectedOption?.dataset.index;
    const isMock = selectedOption?.dataset.mock === 'true';
    const authData = getAuthData();

    if (isMock && selectedIndex !== undefined && mockActivities[selectedIndex]) {
        selectedActivity = mockActivities[selectedIndex];
    } else if (!isMock && selectedIndex !== undefined && currentActivities[selectedIndex]) {
        selectedActivity = currentActivities[selectedIndex];
    } else {
        // Fallback if selection is somehow invalid
        selectedActivity = authData ? null : mockActivities[0];
    }
    updateOverlay(selectedActivity);
    drawActivityMap(selectedActivity); // Draw map after updating overlay
}

function handleImageLoad(success, isInitial = false) {
    if (success) {
        // Enable download button only if it's not the initial placeholder
        domElements.downloadBtn.disabled = isInitial;
    } else {
        // Disable download button on load failure
        domElements.downloadBtn.disabled = true;
    }
    // Update overlay and map with the currently selected activity after image load/error
    updateOverlay(selectedActivity);
    drawActivityMap(selectedActivity);
}

function handleStravaConnectCallback(activities) {
    currentActivities = activities; // Store fetched activities
    const authData = getAuthData();
    // If connected and have activities, use the first real one, else use mock/null
    selectedActivity = (authData && activities.length > 0) ? activities[0] : (!authData ? mockActivities[0] : null);
    // Populate select and trigger initial overlay update AND map draw
    populateActivitiesSelect(currentActivities, (activity) => {
        updateOverlay(activity);
        drawActivityMap(activity); // Draw map within the callback
    });
}

function handleDownload() {
    capture().then(blob => {
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 15);
        const filename = `stravify_${timestamp}.jpg`;
        const link = document.createElement('a');
        link.download = filename;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href); // Clean up blob URL
    }).catch(err => {
        console.error("Download failed:", err);
        // Error already alerted in capture()
    });
}

// --- Initialization ---
function init() {
    console.log("Initializing Stravify App");

    // 1. Load Authentication Data
    loadAuthData(); // Check local storage or URL hash

    // 2. Set Initial Image & Update UI based on Auth State
    setInitialImage(
        'https://picsum.photos/id/17/1600/1200',
        'Placeholder image - a landscape',
        (success, isInitial) => {
            // This callback now handles the initial overlay/map update AFTER image load
            handleImageLoad(success, isInitial);
            // 3. Update Strava Button state (which triggers activity fetch/population)
            updateStravaButtonState(
                domElements.stravaBtn,
                domElements.stravaStatusIndicator,
                handleStravaConnectCallback // Pass the callback here
            );
        }
    );
    // Note: Initial updateOverlay/drawActivityMap is now handled within setInitialImage callback

    // 4. Setup Event Listeners
    domElements.uploadArea.addEventListener('click', () => domElements.fileInput.click());
    domElements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            loadImageFromFile(file, handleImageLoad);
        } else if (file) {
            alert("Please select a valid image file.");
        }
        e.target.value = null; // Reset input for same-file selection
    });

    domElements.activitiesSelect.addEventListener('change', handleActivitySelectionChange);

    // Overlay Drag Listeners (attach to wrapper for better event delegation)
    domElements.wrapper.addEventListener('pointerdown', pointerDown);
    domElements.wrapper.addEventListener('pointermove', pointerMove);
    domElements.wrapper.addEventListener('pointerup', pointerUp);
    // Add pointerleave as well to handle cases where the pointer leaves the wrapper while dragging
    domElements.wrapper.addEventListener('pointerleave', pointerUp);

    domElements.downloadBtn.addEventListener('click', handleDownload);

    // Initial overlay position reset (might be redundant if setInitialImage calls it)
    resetOverlayPosition();
}

// --- Run ---
// Ensure DOM is fully loaded before running init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init(); // DOMContentLoaded has already fired
}
