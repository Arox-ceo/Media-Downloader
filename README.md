# Media Downloader — YouTube, TikTok, Instagram, Pinterest

One link field with automatic platform detection. Dark pink/cyan design and original **Zarvions_Z** credit retained.

## What works, and what needs a server

| Platform | Media implemented | Service |
|---|---|---|
| YouTube | Public videos, Shorts, MP3 | Your backend |
| TikTok | Video, audio, photos, mobile share | Existing external TikWM API |
| Instagram | Public video posts and Reels | Your backend |
| Pinterest | Video Pins | Your backend |

Instagram photos/carousels of images, Pinterest image Pins, private posts, live broadcasts and account login are **not supported**. Video carousels process only the first video. Platforms may reject hosting IP addresses or require sign-in. No guarantee is made that every public post can be fetched.

**Uploading this repository does not create an online download backend.** GitHub Pages hosts the interface only. With no backend configured, the site explains this; TikTok can still use its existing third-party resolver, subject to provider availability and browser CORS.

## A. Publish the interface on GitHub Pages

1. Extract this ZIP. Upload its contents to your repository, including the `public` folder and `.github/workflows/pages.yml`.
2. GitHub repository → **Settings → Pages → Source: GitHub Actions**.
3. Push to `main`, or open **Actions → Publish website to GitHub Pages → Run workflow**.
4. After success, use the URL shown by the deployment. Never guess the final URL.

If the browser upload cannot include `.github`, create a file directly in GitHub named `.github/workflows/pages.yml` and paste the contents of the supplied file. Do not upload the ZIP as the application.

Reference: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## B. Connect an online backend

No paid hosting is required by the code, but an **actual online server is required** for YouTube/Instagram/Pinterest. This package includes the backend; it does not include a free hosted service or an API key. A computer with a public HTTPS tunnel is an option only while that computer remains online. Do not use GitHub Actions as a permanent download server.

1. Run the Dockerfile on a server that supports Docker, or install Node.js 22+, yt-dlp and FFmpeg and run `npm start`.
2. On the server set `FRONTEND_ORIGIN=https://YOUR-NAME.github.io` (the origin only, without the repository path). Multiple origins may be comma-separated. Set `HOST=0.0.0.0` when the hosting platform requires it.
3. Edit `public/config.js`:

```js
window.MEDIA_CONFIG = { apiBase: 'https://YOUR-BACKEND-DOMAIN' };
```

4. Commit that change and wait for Pages to redeploy. The site should show **Video service connected**. Test with public links you have permission to download.

Use the HTTPS backend origin with no trailing API path. It is a public address, not a secret. Never put login cookies, passwords or API secrets in this file.

Alternatively host this whole project on one server. Leave `apiBase` empty and open that server’s URL. GitHub still stores the source.

## Local development

Install Node.js 22+, yt-dlp with default dependencies, and FFmpeg. Then run:

```sh
npm start
```

Open http://127.0.0.1:8787. Optional `YTDLP_PATH` and `FFMPEG_PATH` identify executable locations. The Dockerfile includes the runtime tools:

```sh
docker build -t media-downloader .
docker run --rm -p 8787:10000 media-downloader
```

## Limits and verification

Video files: up to 20 minutes, 1080p, and 200 MB. Two engine operations at a time, one active download per session, ten retained jobs. Prepared files expire after 30 minutes, with a cleanup interval of one minute. Browser sessions are independent. Temporary files and session state do not survive server restarts.

Run `npm test` to check supported URL validation, cross-origin access configuration, session isolation, file access checks and static routes. Automated tests use no real platform media. Confirm real downloads from all desired platforms on the target host before advertising availability.

This is a small single-instance deployment, not an unlimited large-traffic service. Session-based request limits can be reset by creating a new session. Larger traffic needs edge rate limits, a queue, storage quotas and additional workers. Source-size metadata can be inaccurate; enforce disk and memory limits on the host.

Download only content you own or have permission to save. TikTok requests are sent to TikWM; other links are processed by your backend. Keep yt-dlp updated as platforms change. Third-party tools retain their own licenses.
