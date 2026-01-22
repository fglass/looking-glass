# looking-glass

[Homecooked Snapchat](https://fred.glass/homecooked-snapchat/). No backend or serverless functions, only S3.

## Features

- 🌅 Gallery view
- 😂 Emoji reactions
- 🔥 Fake streak counter
- 👈 Scratch-to-reveal
- 🔔 Push notifications

## Setup

1. Create an Expo project (required for push notifications & build)
1. Create an S3 bucket and IAM role (`AmazonS3FullAccess`)
1. Set environment variables (via `.env`/`eas.json`)
1. Run `npm install && npm run start`
1. Create an [Expo build](https://docs.expo.dev/build/setup/)
   - Create [multiple app variants](https://docs.expo.dev/tutorial/eas/multiple-app-variants/) to use different buckets

## Media

<img src="https://bear-images.sfo2.cdn.digitaloceanspaces.com/fredglass/looking-glass-raw.webp" alt="image" height="350"/>
