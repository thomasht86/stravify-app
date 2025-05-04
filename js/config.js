export const STRAVA_CLIENT_ID = '76899';
export const STRAVA_REDIRECT_URI = 'https://thomasht86--stravify-oauth-fastapi-app.modal.run/login';
export const STRAVA_AUTH_URL = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${STRAVA_REDIRECT_URI}&approval_prompt=auto&scope=activity:read`;
export const STRAVA_API_URL = 'https://www.strava.com/api/v3';

// Updated mock data
export const mockActivities = [
    { id: 'mock-run', name: 'Morning Run', type: 'Run', distance: 5123.4, moving_time: 1800, total_elevation_gain: 55.6, start_date_local: new Date(Date.now() - 86400000).toISOString(), average_heartrate: 155.2, average_speed: 2.846, suffer_score: 45 },
    { id: 'mock-ride', name: 'Weekend Ride', type: 'Ride', distance: 25450.1, moving_time: 5400, total_elevation_gain: 210.3, start_date_local: new Date(Date.now() - 2 * 86400000).toISOString(), average_heartrate: 138.9, average_speed: 4.713, suffer_score: 60 },
    { id: 'mock-walk', name: 'Evening Walk', type: 'Walk', distance: 3050.0, moving_time: 2700, total_elevation_gain: 15.0, start_date_local: new Date(Date.now() - 3 * 86400000).toISOString(), average_heartrate: 95.5, average_speed: 1.13 },
    { id: 'mock-hike', name: 'Mountain Hike', type: 'Hike', distance: 12800.5, moving_time: 10800, total_elevation_gain: 650.8, start_date_local: new Date(Date.now() - 4 * 86400000).toISOString(), average_speed: 1.185, suffer_score: 80 },
    { id: 'mock-other', name: 'Gym Session', type: 'Workout', distance: 0, moving_time: 3600, total_elevation_gain: 0, start_date_local: new Date(Date.now() - 5 * 86400000).toISOString(), average_heartrate: 110.0 }
];
