# Google CLI Re-Auth Steps

## Overview
These steps document how the Google Cloud CLI was re-run to refresh application-default credentials and verify Firebase configuration access.

## Commands Executed

1. **Authenticate ADC**
   ```bash
   gcloud auth application-default login
   ```
   - Opens a browser window to log in as the desired Google account.
   - Saves refreshed credentials to `~/.config/gcloud/application_default_credentials.json`.

2. **Set Quota Project**
   ```bash
   gcloud auth application-default set-quota-project budbase-c4f76
   ```
   - Associates ADC usage with the `budbase-c4f76` project for quota/billing.

3. **List Firebase Web Apps**
   ```bash
   ACCESS_TOKEN=$(gcloud auth print-access-token)
   curl -sS \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "X-Goog-User-Project: budbase-c4f76" \
     "https://firebase.googleapis.com/v1beta1/projects/budbase-c4f76/webApps"
   ```
   - Confirms that Firebase Management API access works with the refreshed credentials.

## Notes
- Ensure the `firebase.googleapis.com` service is enabled on the project if the API call returns `SERVICE_DISABLED`.
- Use the returned `appId` to fetch detailed config via the `/config` endpoint when updating frontend environment variables.
