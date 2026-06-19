# Deployment

This dashboard runs as a single Node web service, so the simplest path is to deploy it as-is.

## Render

1. Push this repo to GitHub.
2. Create a new Render Web Service from that repository.
3. Use these settings:
   - Build command: `npm install`
   - Start command: `npm start`
4. Add your environment variables in Render if you want Sheets integration:
   - `GOOGLE_SPREADSHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `APPS_SCRIPT_URL` if you use the Apps Script bridge
   - `BASE_PATH=/ijtima` if you are mounting the app under a subpath like `yourdomain.ca/ijtima`

Render will provide the `PORT` value automatically.

## Heroku-style hosts

The included `Procfile` lets platforms that support it start the app with `npm start`.

## Hostinger domain

If your domain is registered with Hostinger, the easiest setup is to keep the app running on a Node host such as Render and point the Hostinger domain to it.

If your Hostinger cloud plan already has another website on the root domain, do not replace it. Use a subdomain for the dashboard instead.

Recommended address:

```text
ijtima.yourdomain.ca
```

### Best path for your setup

1. Keep the existing website on `yourdomain.ca`.
2. Create the subdomain `ijtima.yourdomain.ca` in Hostinger.
3. Deploy the dashboard as a separate app.
4. Point the subdomain to the app host or connect it directly if your Hostinger cloud panel supports Node apps.

If Hostinger cloud gives you Node.js app hosting, you can upload this project there and start it with `npm start`. Use `BASE_PATH=/` for a root deployment or leave it unset for a subdomain deployment.

1. Deploy the dashboard first and get the public URL from your host.
2. In Hostinger, open the domain's DNS zone.
3. Add a `CNAME` record for `www` that points to the host URL or target provided by your deployment platform.
4. Add the custom domain in your deployment platform so it issues SSL for the domain.
5. For the root domain, either set a redirect to `www` in Hostinger or use the DNS record type recommended by your host if Hostinger supports it for your plan.

If you are on Hostinger VPS or cloud hosting instead of shared hosting, the Node app can run there directly. In that case you would install Node.js, upload the files, set the environment variables, and start the app with `npm start`.

For a subpath deployment such as `yourdomain.ca/ijtima`, set `BASE_PATH=/ijtima` in the Node host and open the site at that path.

For a subdomain deployment such as `ijtima.yourdomain.ca`, leave `BASE_PATH` unset and map the subdomain directly to the dashboard app.

## Local test

Run the app locally with:

```text
npm start
```

Then open:

```text
http://localhost:3000
```