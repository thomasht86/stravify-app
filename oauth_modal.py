import os
from urllib.parse import urlencode, urlunparse, ParseResult

import httpx
import modal
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import RedirectResponse

# --- Modal Setup ---
image = modal.Image.debian_slim().pip_install(["fastapi", "httpx"])
app = modal.App(
    "stravify-oauth", image=image, secrets=[modal.Secret.from_name("stravify-secret")]
)

# --- Strava Constants ---
STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"


# --- Modal Function with FastAPI App ---
@app.function()
@modal.asgi_app()
def fastapi_app():
    web_app = FastAPI(
        title="Strava OAuth Handler (Modal)",
        description="Minimal serverless-friendly API via Modal to handle Strava OAuth flow.",
    )

    # --- Environment Variable Access ---
    # These are expected to be set via Modal Secrets or environment configuration
    STRAVA_CLIENT_ID = os.environ.get("STRAVA_CLIENT_ID")
    STRAVA_CLIENT_SECRET = os.environ.get("STRAVA_CLIENT_SECRET")
    # Use the auto-generated Modal web endpoint URL for the callback
    # Note: This needs to be registered in your Strava App settings!
    APP_CALLBACK_URL = f"{fastapi_app.web_url}/callback"
    FRONTEND_REDIRECT_URL = os.environ.get("FRONTEND_REDIRECT_URL")
    STRAVA_SCOPES = os.environ.get("STRAVA_SCOPES", "read")  # Default scope

    if not all([STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, FRONTEND_REDIRECT_URL]):
        # This check runs when the container starts.
        # Consider how to handle missing env vars gracefully during runtime if needed.
        print("Warning: One or more required environment variables are missing!")
        # You might want to raise an exception or handle this differently

    # --- Endpoints ---

    @web_app.get("/login")
    async def strava_login_redirect():
        """
        Redirects the user to Strava's authorization page.
        The frontend should link to this endpoint.
        """
        if not STRAVA_CLIENT_ID:
            raise HTTPException(
                status_code=500,
                detail="Server configuration error: STRAVA_CLIENT_ID missing.",
            )

        params = {
            "client_id": STRAVA_CLIENT_ID,
            "redirect_uri": APP_CALLBACK_URL,  # Use the Modal web URL
            "response_type": "code",
            "approval_prompt": "auto",  # Use 'force' to always show auth screen
            "scope": STRAVA_SCOPES,
        }
        auth_url = f"{STRAVA_AUTH_URL}?{urlencode(params)}"
        print(f"Redirecting user to: {auth_url}")  # For debugging
        return RedirectResponse(url=auth_url)

    @web_app.get("/callback")
    async def strava_callback(
        code: str = Query(..., description="Authorization code from Strava"),
        scope: str = Query(..., description="Scopes granted by user"),
        error: str | None = Query(None, description="Error from Strava (if any)"),
    ):
        """
        Handles the callback from Strava after user authorization.
        Exchanges the code for an access token and redirects to the frontend.
        This endpoint URL MUST be registered in your Strava App settings.
        """
        if not all([STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, FRONTEND_REDIRECT_URL]):
            raise HTTPException(
                status_code=500,
                detail="Server configuration error: Missing required secrets.",
            )

        if error:
            print(f"Error received from Strava: {error}")
            # Redirect to frontend with error information if desired
            # For simplicity, raising an HTTP error here. Adjust as needed.
            raise HTTPException(
                status_code=400, detail=f"Strava authorization failed: {error}"
            )

        print(f"Received callback code: {code}, scope: {scope}")  # For debugging

        # Prepare data to exchange code for token
        token_payload = {
            "client_id": STRAVA_CLIENT_ID,
            "client_secret": STRAVA_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(STRAVA_TOKEN_URL, data=token_payload)
                response.raise_for_status()  # Raise exception for 4xx or 5xx status codes
                token_data = response.json()
                print("Successfully exchanged code for token.")  # For debugging

            except httpx.RequestError as req_err:
                print(f"HTTP Request Error during token exchange: {req_err}")
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to communicate with Strava: {req_err}",
                )
            except httpx.HTTPStatusError as status_err:
                print(
                    f"Strava API Error during token exchange: {status_err.response.status_code} - {status_err.response.text}"
                )
                raise HTTPException(
                    status_code=status_err.response.status_code,
                    detail=f"Strava API error: {status_err.response.text}",
                )
            except Exception as e:
                print(f"An unexpected error occurred during token exchange: {e}")
                raise HTTPException(
                    status_code=500,
                    detail="Internal server error during token exchange.",
                )

        # --- Redirect user back to the FRONTEND ---
        # Pass token info in the URL fragment (#) suitable for SPAs
        fragment_params = {
            "access_token": token_data.get("access_token"),
            "expires_at": token_data.get("expires_at"),
            "expires_in": token_data.get("expires_in"),
            "refresh_token": token_data.get("refresh_token"),
            "scope": scope,  # Pass the granted scope back
            "token_type": token_data.get("token_type", "Bearer"),
        }
        # Filter out any None values
        fragment_params = {k: v for k, v in fragment_params.items() if v is not None}

        # Construct the final redirect URL for the frontend
        frontend_url_parts = ParseResult(
            scheme="",
            netloc="",
            path=FRONTEND_REDIRECT_URL,
            params="",
            query="",
            fragment=urlencode(fragment_params),
        )
        final_redirect_url = urlunparse(frontend_url_parts)

        print(
            f"Redirecting user to frontend: {FRONTEND_REDIRECT_URL} with token info in fragment."
        )  # For debugging
        return RedirectResponse(
            url=final_redirect_url, status_code=303
        )  # Use 303 See Other

    # Optional: Root endpoint for health check or info
    @web_app.get("/")
    async def root():
        # Display the callback URL for easy registration in Strava settings
        return {
            "message": "Strava OAuth Handler (Modal) is running.",
            "strava_callback_url_to_register": APP_CALLBACK_URL,
        }

    return web_app


# Note: The local testing block (`if __name__ == "__main__":`) is removed
# as Modal handles the deployment and serving.
# To test locally with Modal, use `modal serve oauth_modal.py`.
# Ensure you have a .env file or environment variables set locally for testing.
