<div align="center">
  <img src="https://apparyllis.com/wp-content/uploads/2021/12/SimplyPlural-NoBg.png" style="width:250px; height:250px"/>
</div>  

[![Docker](https://github.com/ApparyllisOrg/SimplyPluralApi/actions/workflows/docker.yml/badge.svg?branch=main)](https://github.com/ApparyllisOrg/SimplyPluralApi/actions/workflows/docker.yml)
[![Run lint](https://github.com/ApparyllisOrg/SimplyPluralApi/actions/workflows/lint.yml/badge.svg)](https://github.com/ApparyllisOrg/SimplyPluralApi/actions/workflows/lint.yml)
[![Run tests](https://github.com/ApparyllisOrg/SimplyPluralApi/actions/workflows/test.yml/badge.svg)](https://github.com/ApparyllisOrg/SimplyPluralApi/actions/workflows/test.yml)

Simply Plural API is the backend for the app "Simply Plural". Simply Plural is created and managed by [Apparyllis](https://apparyllis.com/).

The SDK counterpart for Dart/Flutter can be found here.
## Support us
You can support the development of Simply Plural by becoming a patron over at https://www.patreon.com/apparyllis. ❤️

Another way to support is by developing and submitting pull requests to this repository or our SDK for Dart/Flutter.

A big thank you to our biggest sponsor:  [The Plural Association](https://twitter.com/TpaNonprofit) ❤️

## Features

The Simply Plural API has a host of functionalities. 
* GET, POST, PATCH, DELETE requests for all data-related activities for Simply Plural
* Event handlers such as Front Notifications and Reminders
* Creation and deletion of user accounts
* Exporting and creating reports of user data
* Uploading and deleting of user avatars
* Friend-related functionalities such as Add friends, Remove Friends, etc.
* Syncing information between Simply Plural and third party integrations such as PluralKit
## Environment variables

**Required:**

- `DATABASE_URI`: a MongoDB connection URI (for example, `mongodb://localhost:27017`)
- `TLS_CERT`, `TLS_KEY`: (if SSL is enabled) Path to SSL certificate and key.

**Optional:**

- `PORT`: port to listen on (same for http or https - *defaults to 8443*)
- `DISABLE_TLS`: will disable HTTPS (for example, when behind a proxy or load balancer)
- `SPACES_KEY`, `SPACES_SECRET`: Key ID and secret for DigitalOcean Spaces

## Pull Requests
When doing cosmetic pull requests (such as typo fixes, formatting fixes), please PR into main. For any other pull requests (such as feature changes, new features, fixes, etc.), please PR into the pretesting branch.
