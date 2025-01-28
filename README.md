# looking-glass

[Homecooked Snapchat](https://fred.glass/homecooked-snapchat/), backed by S3.

## Setup

1. Create an Expo project (required for push notifications & build)
1. Create an S3 bucket and IAM role (`AmazonS3FullAccess`)
1. Set environment variables (via `.env`/`eas.json`)
1. Run `npm install && npm run start`
1. [Optional] Create an [Expo build](https://docs.expo.dev/build/setup/)
   - Create [multiple app variants](https://docs.expo.dev/tutorial/eas/multiple-app-variants/) to use different buckets
