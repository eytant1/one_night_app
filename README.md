# one_night_app

A Hebrew narrator app for One Night–style games. You define the characters, record their night instructions, build lineups, and the app plays the night in order. It works fully offline on a single phone.

See [docs/DESIGN.md](docs/DESIGN.md) for the design.

## Development

Requires Node.js 18+.

```sh
npm install
npm run dev        # dev server, also reachable from your phone on the same Wi-Fi
npm run build      # production build into dist/
npm run preview    # serve the production build
```

Microphone recording needs a secure context: `localhost` works, but opening the dev server from a phone by IP does not. To test recording on a phone, deploy the build to an HTTPS host (for example GitHub Pages).

## Installing on a phone

Open the deployed site in Chrome (Android) or Safari (iPhone), then choose **Add to Home Screen**. After the first load the app works with no internet connection. All data is stored on the phone.
