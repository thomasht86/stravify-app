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
