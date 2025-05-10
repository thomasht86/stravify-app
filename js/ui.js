import { mockActivities } from './config.js';
import { getAuthData } from './strava.js'; // To check auth status for mock data display

let drag = null;
let originalImageWidth = null;
let originalImageHeight = null;

// --- DOM Element Getters (Assumes elements exist) ---
const getElement = (id) => document.getElementById(id);
export const domElements = {
    fileInput: getElement('upload'),
    uploadArea: getElement('uploadArea'),
    downloadBtn: getElement('downloadBtn'),
    wrapper: getElement('preview-wrapper'),
    img: getElement('preview-image'),
    overlay: getElement('statsCard'),
    activityPicker: getElement('activityPicker'),
    activitiesSelect: getElement('activities'),
    mapToggleContainer: getElement('mapToggleContainer'), // Add map toggle container
    stravaBtn: getElement('stravaBtn'),
    stravaStatusIndicator: getElement('stravaStatusIndicator'),
    ovTitle: getElement('activityTitle'),
    ovIcon: getElement('activityIcon'),
    ovDistance: getElement('distance'),
    ovDuration: getElement('duration'),
    ovElev: getElement('elev'),
    avgHrDiv: getElement('avgHrDiv'),
    ovAvgHr: getElement('avgHr'),
    avgSpeedDiv: getElement('avgSpeedDiv'),
    ovAvgSpeed: getElement('avgSpeed'),
    ovAvgSpeedUnit: getElement('avgSpeedUnit'),
    sufferScoreDiv: getElement('sufferScoreDiv'),
    ovSufferScore: getElement('sufferScore'),
    activityMapCanvas: getElement('activityMapCanvas'),
    overlayFooter: getElement('overlayFooter'), // Add the new footer element
    overlayStravaLogo: getElement('overlayStravaLogo'), // Add the Strava logo in footer
};

// --- Utility Functions ---

export function setLoadingState(isLoading, button) {
    const { downloadBtn, stravaBtn } = domElements; // Get buttons from DOM elements
    if (!button) return; // Safety check

    if (isLoading) {
        button.setAttribute('aria-busy', 'true');
        button.disabled = true;
    } else {
        button.setAttribute('aria-busy', 'false');
        // Special handling for enabling/disabling based on state
        if (button === downloadBtn) {
            // Enable download only if an image is loaded (check img.src)
            button.disabled = !(domElements.img.src && !domElements.img.src.endsWith('/')); // Basic check if src is set and not empty/placeholder
        } else if (button === stravaBtn) {
            // Disable Strava button only if authenticated
            button.disabled = !!getAuthData();
        } else {
            // Default: enable the button
            button.disabled = false;
        }
    }
}


export function secondsToHms(seconds) {
    if (isNaN(seconds) || seconds < 0) return '--';
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function getActivityIcon(type) {
    if (!type) return '';
    const typeLower = type.toLowerCase();
    switch (typeLower) {
        case 'run': return 'directions_run';
        case 'ride': return 'directions_bike';
        case 'walk': return 'directions_walk';
        case 'hike': return 'hiking';
        case 'swim': return 'pool';
        case 'workout': return 'fitness_center';
        default: return 'exercise';
    }
}

export function formatSpeed(speedMps, activityType) {
    if (isNaN(speedMps) || speedMps <= 0) return { value: '--', unit: '' };
    const typeLower = activityType?.toLowerCase() || '';

    if (typeLower === 'run' || typeLower === 'walk' || typeLower === 'hike') {
        const paceDecimal = 1000 / (speedMps * 60);
        if (!isFinite(paceDecimal)) return { value: '--', unit: 'min/km' };
        const minutes = Math.floor(paceDecimal);
        const seconds = Math.round((paceDecimal - minutes) * 60);
        return { value: `${minutes}:${String(seconds).padStart(2, '0')}`, unit: 'min/km' };
    } else { // Default to km/h for Ride and others
        const speedKph = speedMps * 3.6;
        return { value: speedKph.toFixed(1), unit: 'km/h' };
    }
}

// --- UI Update Functions ---

export function populateActivitiesSelect(activities, onActivitySelected) {
    const { activitiesSelect } = domElements;
    activitiesSelect.innerHTML = ''; // Clear existing options

    const authData = getAuthData(); // Check auth status

    if (authData) { // User is connected
        if (activities.length > 0) {
            activities.forEach((activity, index) => {
                const option = new Option(
                    `${new Date(activity.start_date_local).toLocaleDateString()} - ${activity.name} (${activity.type || 'Activity'})`,
                    activity.id
                );
                option.dataset.index = index; // Store index to retrieve full activity object later
                activitiesSelect.appendChild(option);
            });
            // Select the first activity by default and trigger update
            if (activitiesSelect.options.length > 0) {
                activitiesSelect.value = activitiesSelect.options[0].value;
                onActivitySelected(activities[0]); // Pass the selected activity object
            }
        } else {
            const option = new Option("No recent activities found", "");
            option.disabled = true;
            activitiesSelect.appendChild(option);
            onActivitySelected(null); // No activity to select
        }
    } else { // User is not connected, show mock data
        const connectOption = new Option("Connect to Strava to see your activities", "");
        connectOption.disabled = true;
        activitiesSelect.appendChild(connectOption);

        mockActivities.forEach((activity, index) => {
            const option = new Option(
                `${new Date(activity.start_date_local).toLocaleDateString()} - ${activity.name} (Sample)`,
                activity.id
            );
            option.dataset.index = index;
            option.dataset.mock = 'true'; // Mark as mock
            activitiesSelect.appendChild(option);
        });

        // Select the first mock activity by default
        if (mockActivities.length > 0) {
            activitiesSelect.value = mockActivities[0].id;
            onActivitySelected(mockActivities[0]); // Pass the selected mock activity
        } else {
            onActivitySelected(null);
        }
    }
}


export function updateOverlay(activity = null) {
    const {
        ovTitle, ovIcon, ovDistance, ovDuration, ovElev,
        avgHrDiv, ovAvgHr, avgSpeedDiv, ovAvgSpeed, ovAvgSpeedUnit,
        sufferScoreDiv, ovSufferScore
    } = domElements;

    console.log("Updating overlay with data:", activity);

    // --- Row 1 ---
    ovTitle.textContent = activity?.name || 'Activity Title';
    ovDistance.textContent = activity?.distance ? (activity.distance / 1000).toFixed(1) : '--';
    ovDuration.textContent = activity?.moving_time ? secondsToHms(activity.moving_time) : '--';
    ovElev.textContent = activity?.total_elevation_gain ? Math.round(activity.total_elevation_gain) : '--';
    const iconName = activity ? getActivityIcon(activity.type) : '';
    ovIcon.textContent = iconName;
    ovIcon.style.display = iconName ? 'inline-block' : 'none';

    // --- Row 2 ---
    if (activity?.average_heartrate) {
        ovAvgHr.textContent = Math.round(activity.average_heartrate);
        avgHrDiv.style.display = 'block';
    } else {
        avgHrDiv.style.display = 'none';
    }
    if (activity?.average_speed) {
        const { value, unit } = formatSpeed(activity.average_speed, activity.type);
        ovAvgSpeed.textContent = value;
        ovAvgSpeedUnit.textContent = unit;
        avgSpeedDiv.style.display = value !== '--' ? 'block' : 'none';
    } else {
        avgSpeedDiv.style.display = 'none';
    }
    if (activity?.suffer_score) {
        ovSufferScore.textContent = activity.suffer_score;
        sufferScoreDiv.style.display = 'block';
    } else {
        sufferScoreDiv.style.display = 'none';
    }
}

// --- Image Handling ---

export function loadImageFromFile(file, onImageLoad) {
    const { img, overlay } = domElements;
    const reader = new FileReader();

    reader.onload = (e) => {
        img.onload = () => {
            originalImageWidth = img.naturalWidth;
            originalImageHeight = img.naturalHeight;
            console.log(`Original image dimensions: ${originalImageWidth}x${originalImageHeight}`);
            resetOverlayPosition(); // Reset position when new image loads
            overlay.style.visibility = 'visible';
            onImageLoad(true); // Signal successful load
        };
        img.onerror = () => {
            console.error("Error loading image.");
            alert("Could not load the selected image file.");
            overlay.style.visibility = 'hidden';
            originalImageWidth = null;
            originalImageHeight = null;
            onImageLoad(false); // Signal failed load
        };
        img.src = e.target.result;
        img.alt = `Preview of ${file.name}`;
    };
    reader.onerror = () => {
        console.error("Error reading file.");
        alert("Could not read the selected file.");
        overlay.style.visibility = 'hidden';
        originalImageWidth = null;
        originalImageHeight = null;
        onImageLoad(false); // Signal failed load
    };
    reader.readAsDataURL(file);
}

export function setInitialImage(src, alt, onImageLoad) {
    const { img, overlay } = domElements;
    img.onload = () => {
        originalImageWidth = img.naturalWidth;
        originalImageHeight = img.naturalHeight;
        console.log(`Initial image dimensions: ${originalImageWidth}x${originalImageHeight}`);
        resetOverlayPosition();
        overlay.style.visibility = 'visible';
        onImageLoad(true, false); // Signal success, indicate it's the initial image
    };
    img.onerror = () => {
        console.error("Placeholder image failed to load.");
        img.alt = 'Placeholder image failed to load.';
        originalImageWidth = null;
        originalImageHeight = null;
        resetOverlayPosition();
        overlay.style.visibility = 'visible'; // Keep overlay visible for default data
        onImageLoad(false, true); // Signal failure, indicate it's the initial image
    };
    img.src = src;
    img.alt = alt;
}

// --- Overlay Drag Logic ---

export function resetOverlayPosition() {
    const { overlay } = domElements;
    overlay.style.left = '1rem';
    overlay.style.top = '1rem';
    overlay.style.bottom = 'auto'; // Ensure bottom is not set
    overlay.style.right = 'auto'; // Ensure right is not set
}

export function pointerDown(ev) {
    const { overlay } = domElements;
    // Only drag if the event target is the overlay itself or one of its direct children
    if (!overlay.contains(ev.target) || overlay.style.visibility === 'hidden') return;

    ev.preventDefault(); // Prevent text selection, etc.
    const currentTop = overlay.offsetTop;
    const currentLeft = overlay.offsetLeft;
    drag = {
        startX: ev.clientX,
        startY: ev.clientY,
        origX: currentLeft,
        origY: currentTop,
    };
    // Ensure position is controlled by top/left
    overlay.style.bottom = 'auto';
    overlay.style.right = 'auto';
    overlay.style.top = `${drag.origY}px`;
    overlay.style.left = `${drag.origX}px`;

    overlay.setPointerCapture(ev.pointerId); // Capture pointer events
    overlay.style.cursor = 'grabbing';
}

export function pointerMove(ev) {
    if (!drag) return;
    const { overlay, wrapper } = domElements;
    ev.preventDefault();

    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;
    let newX = drag.origX + dx;
    let newY = drag.origY + dy;

    // Get overlay dimensions *after* potential scaling by container queries
    const overlayRect = overlay.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect(); // Use getBoundingClientRect for consistency

    // Calculate bounds based on the wrapper's client dimensions
    const maxX = wrapper.clientWidth - overlayRect.width;
    const maxY = wrapper.clientHeight - overlayRect.height;

    // Clamp position within the wrapper bounds
    newX = Math.max(0, Math.min(maxX, newX));
    newY = Math.max(0, Math.min(maxY, newY));

    overlay.style.left = `${newX}px`;
    overlay.style.top = `${newY}px`;
}


export function pointerUp(ev) {
    if (!drag) return;
    const { overlay } = domElements;
    overlay.releasePointerCapture(ev.pointerId); // Release pointer
    overlay.style.cursor = 'grab'; // Reset cursor
    drag = null; // Clear drag state
}

// --- Image Capture ---

export function capture() {
    const { wrapper, overlay, downloadBtn } = domElements;
    setLoadingState(true, downloadBtn);

    // Temporarily remove wrapper border radius for cleaner capture
    const prevRadius = wrapper.style.borderRadius;
    wrapper.style.borderRadius = '0';

    // Ensure overlay is visible for capture, remember original state
    const overlayWasVisible = overlay.style.visibility !== 'hidden';
    if (!overlayWasVisible) {
        overlay.style.visibility = 'visible';
    }

    // Calculate scale based on original image width vs displayed width
    let finalScale = 1;
    const displayedWidth = domElements.img.clientWidth;
    if (originalImageWidth && displayedWidth > 0) {
        finalScale = originalImageWidth / displayedWidth; // Target original image resolution

        // Clamp scale to ensure the *output width of the image part* doesn't exceed maxDim
        const maxDim = 4096; // Maximum desired dimension for the image part in the capture
        // The effective width of the image in the canvas will be displayedWidth * finalScale
        // which we want to be originalImageWidth.
        // If originalImageWidth itself is greater than maxDim, we cap it.
        if (originalImageWidth > maxDim) {
            finalScale = maxDim / displayedWidth; // Adjust scale so image part width becomes maxDim
        }
        console.log(`Calculated finalScale for html2canvas: ${finalScale} (Original: ${originalImageWidth}, Displayed: ${displayedWidth}, Target Output Image Width: ${displayedWidth * finalScale})`);
    } else {
        console.warn("Could not determine original image width or preview width for scaling. Using scale 1.");
    }
    finalScale = Math.max(1, finalScale); // Ensure scale is at least 1, so we don't downscale if original is smaller than display


    return html2canvas(wrapper, {
        useCORS: true,      // Needed for external images (like picsum or Strava map)
        allowTaint: true,   // May help with CORS issues but can taint canvas
        backgroundColor: null, // Use transparent background
        scale: finalScale,     // Render at calculated scale
        logging: false,      // Disable html2canvas console logs
        imageTimeout: 15000 // Increase timeout for potentially slow images
    })
        .then(canvas => {
            // Convert canvas to Blob
            return new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob); // Resolve with the blob
                    } else {
                        reject(new Error("Failed to create blob from canvas"));
                    }
                }, 'image/jpg', 0.95); // Use JPEG format for better compression
            });
        })
        .catch(error => {
            console.error("html2canvas error:", error);
            alert(`Failed to capture image. Error: ${error.message}`);
            return Promise.reject(error); // Propagate the error
        })
        .finally(() => {
            // Restore previous state
            wrapper.style.borderRadius = prevRadius;
            if (!overlayWasVisible) {
                overlay.style.visibility = 'hidden'; // Hide overlay if it wasn't visible initially
            }
            setLoadingState(false, downloadBtn); // Reset button state
        });
}
