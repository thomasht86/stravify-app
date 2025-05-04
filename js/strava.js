import { STRAVA_AUTH_URL, STRAVA_API_URL } from './config.js';
import { setLoadingState } from './ui.js'; // Assuming setLoadingState is exported from ui.js

let authData = null;

export function getAuthData() {
    return authData;
}

export function loadAuthData() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.has('access_token')) {
        const auth = {
            access_token: hashParams.get('access_token'),
            refresh_token: hashParams.get('refresh_token'),
            expires_at: Number(hashParams.get('expires_at'))
        };
        localStorage.setItem('stravaAuth', JSON.stringify(auth));
        // Clean the URL
        history.replaceState(null, '', window.location.pathname + window.location.search);
        authData = auth;
    } else {
        authData = JSON.parse(localStorage.getItem('stravaAuth') || 'null');
    }
    // Basic check for expiration (can be improved with refresh token logic)
    if (authData && authData.expires_at && authData.expires_at * 1000 < Date.now()) {
        console.log("Strava token likely expired.");
        localStorage.removeItem('stravaAuth');
        authData = null;
    }
    return authData;
}

export function updateStravaButtonState(stravaBtn, stravaStatusIndicator, onConnectCallback) {
    if (authData) {
        stravaBtn.href = '#'; // Prevent navigation
        stravaBtn.classList.add('connected');
        stravaBtn.onclick = (e) => e.preventDefault(); // Disable click action

        stravaStatusIndicator.textContent = 'Connected ✅';
        stravaStatusIndicator.classList.add('connected');

        // Fetch activities immediately after confirming connection
        fetchActivities(stravaBtn).then(onConnectCallback);
    } else {
        stravaBtn.onclick = null; // Remove previous handler if any
        stravaBtn.classList.remove('connected');
        stravaBtn.href = STRAVA_AUTH_URL; // Set the correct auth URL

        stravaStatusIndicator.textContent = '';
        stravaStatusIndicator.classList.remove('connected');

        // Trigger callback with empty activities if not connected
        onConnectCallback([]);
    }
}

export async function fetchActivities(stravaBtn) {
    if (!authData) return []; // Return empty array if not authenticated

    setLoadingState(true, stravaBtn);
    try {
        const response = await fetch(`${STRAVA_API_URL}/athlete/activities?per_page=10`, {
            headers: { Authorization: `Bearer ${authData.access_token}` }
        });
        if (!response.ok) {
            if (response.status === 401) {
                console.error("Strava token expired or invalid.");
                localStorage.removeItem('stravaAuth');
                authData = null;
                // Optionally trigger a UI update or alert here
                alert("Strava connection expired. Please connect again.");
                // Re-update button state which will then call onConnectCallback([])
                // This requires passing the elements again or structuring differently
                // For now, just return empty and let the caller handle UI update
                return [];
            } else {
                throw new Error(`API error: ${response.statusText}`);
            }
        }
        const activities = await response.json();
        return activities;
    } catch (err) {
        console.error("Error fetching Strava activities:", err);
        alert("Could not fetch Strava activities. Please try again later.");
        return []; // Return empty array on error
    } finally {
        // Only set loading state to false if the button is the Strava button
        // This check prevents interference if another button triggered the loading state
        if (stravaBtn.id === 'stravaBtn') {
            setLoadingState(false, stravaBtn);
        }
    }
}

/**
 * Decodes a polyline string into an array of [lat, lng] coordinates.
 * @param {string} str The encoded polyline string.
 * @returns {Array<[number, number]>} Array of [latitude, longitude] pairs.
 */
export function decodePolyline(str) {
    let index = 0, lat = 0, lng = 0, points = [];
    const len = str.length;
    while (index < len) {
        let b, shift = 0, result = 0;
        // latitude
        do {
            b = str.charCodeAt(index++) - 63;
            if (b < 0) return []; // invalid char
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20 && index < len);
        lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
        // longitude
        shift = 0; result = 0;
        do {
            b = str.charCodeAt(index++) - 63;
            if (b < 0) return []; // invalid char
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20 && index < len);
        lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
        points.push([lat * 1e-5, lng * 1e-5]);
    }
    return points;
}

/**
 * Calculates the centroid of a set of points.
 * @param {Array<Array<[number, number]>>} all Arrays of points.
 * @returns {{lat: number, lon: number}} Centroid coordinates.
 */
export function centroid(all) {
    let sLat = 0, sLon = 0, n = 0;
    all.forEach(pts => pts.forEach(p => { sLat += p[0]; sLon += p[1]; n++; }));
    return { lat: sLat / n, lon: sLon / n };
}

/**
 * Projects geographical coordinates to Cartesian coordinates using Equirectangular projection.
 * @param {Array<[number, number]>} arr Array of [lat, lon] points.
 * @param {{lat: number, lon: number}} c Center point (centroid).
 * @returns {Array<[number, number]>} Array of [x, y] projected points.
 */
export function project(arr, c) {
    const cos0 = Math.cos(c.lat * Math.PI / 180);
    return arr.map(p => {
        let dLon = p[1] - c.lon; if (dLon > 180) dLon -= 360; if (dLon < -180) dLon += 360;
        return [dLon * cos0, p[0] - c.lat];
    });
}

/**
 * Fits projected points into a square canvas size.
 * @param {Array<Array<[number, number]>>} arrays Arrays of projected [x, y] points.
 * @param {number} size The target canvas size (width/height).
 * @returns {Array<Array<[number, number]>>} Arrays of scaled [x, y] pixel coordinates.
 */
export function fit(arrays, size) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    arrays.forEach(a => a.forEach(([x, y]) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }));
    const scale = (size * 0.9) / Math.max(maxX - minX, maxY - minY || 1e-9); // Add padding (0.9)
    return arrays.map(a => a.map(([x, y]) => [(x - (minX + maxX) / 2) * scale + size / 2, ((y - (minY + maxY) / 2) * -scale) + size / 2]));
}

/**
 * Draws the fitted polyline(s) onto the canvas and makes the canvas visible.
 * @param {HTMLCanvasElement} canvasElement The canvas element to draw on.
 * @param {Array<Array<[number, number]>>} polys Arrays of pixel coordinates.
 * @param {number} size The canvas size (used for clearing and calculations).
 */
export function drawMap(canvasElement, polys, size) {
    // Explicitly hide if no canvas or no valid polyline data
    if (!canvasElement || !polys || polys.length === 0 || !polys.some(p => p.length > 0)) {
        if (canvasElement) { // Check if canvasElement exists before trying to style it
            canvasElement.style.display = 'none'; // Hide if no data or invalid data
        }
        return; // Exit early
    }

    canvasElement.style.display = 'block'; // Make canvas visible only if data is valid
    const ctx = canvasElement.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // Use PicoCSS variables for theme-aware colors
    const style = getComputedStyle(document.documentElement);
    const lineColor = style.getPropertyValue('--pico-color') || '#0074D9'; // Fallback color
    // const centerColor = style.getPropertyValue('--pico-primary-focus') || 'red'; // Fallback color

    ctx.lineWidth = 2;
    ctx.strokeStyle = lineColor;
    const breakDist = size * 0.45; // Threshold to break lines (avoids connecting distant segments)

    polys.forEach(arr => {
        // Only process arrays with actual points
        if (arr.length === 0) return;

        ctx.beginPath();
        let prev = null;
        arr.forEach(([x, y]) => {
            if (!prev) { ctx.moveTo(x, y); prev = [x, y]; return; }
            const d = Math.hypot(x - prev[0], y - prev[1]);
            if (d > breakDist) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            prev = [x, y];
        });
        ctx.stroke();
    });

    // Optional: Draw center point
    // ctx.fillStyle = centerColor;
    // ctx.beginPath();
    // ctx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
    // ctx.fill();
}
