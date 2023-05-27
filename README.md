<div align="center">
  <img src="https://apparyllis.com/wp-content/uploads/2021/12/SimplyPlural-NoBg.png" style="width:250px; height:250px"/>
</div>  

[![Docker](https://github.com/ApparyllisOrg/SimplyPluralApi/actions/workflows/docker.yml/badge.svg?branch=main)](https://github.com/ApparyllisOrg/SimplyPluralApi/actions/workflows/docker.yml)
[![Run lint](https://github.com/ApparyllisOrg/SimplyPluralApi/actions/workflows/lint.yml/badge.svg)](https://github.com/ApparyllisOrg/SimplyPluralApi/actions/workflows/lint.yml)
[![Run tests](https://github.com/ApparyllisOrg/SimplyPluralApi/actions/workflows/test.yml/badge.svg)](https://github.com/ApparyllisOrg/SimplyPluralApi/actions/workflows/test.yml)

Simply Plural API is the backend for the app "Simply Plural". Simply Plural is created and managed by [Apparyllis](https://apparyllis.com/).

The SDK counterpart for Dart/Flutter can be found [here](https://github.com/ApparyllisOrg/simply_sdk).
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

**Database:**
- `DATABASE_URI`: a MongoDB connection URI (for example, `mongodb://localhost:27017`)
- `DBNAME`: Name of the database

**Mail:**
- `MAILPORT`: Port for the SMTP server
- `MAILHOST`: Hostname for the SMTP server
- `MAILUSER`: Username for the SMTP server
- `MAILPASSWORD`: Password for the SMTP server

**Sentry:**
- `SENTRY_DSN`: DSN for the Sentry integration

**Storage:**
- `MINIO_KEY`: Key for MinIO
- `MINIO_Secret`: Secret for MinIO
- `OBJECT_HOST`

**Google**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_AUD`
- `GOOGLE_CLIENT_IOS_ID`
- `GOOGLE_CLIENT_SECRET`

**Hash:**
- `PASSWORD_KEY`
- `PASSWORD_SEPERATOR`

**JWT:**
- `JWT_KEY`
- `GOOGLE_CLIENT_JWT_AUD`

**Environment:**
- `PRETESTING`
- `DEVELOPMENT`
- `UNITEST`
- `LOCAL`

**Chat**
- `MESSAGES_KEY`


**Optional:**

- `PORT`: port to listen on, default 3000
- `LOGPREFIX`: Prefix to add to logfiles
- `PLURALKITAPP`: PluralKit-granted header to have an increased rate limit
- `LOCALEVENTS`: Whether to run the event controller
- `SOCKETEMIT`: Whether to enable the socket emits for Mongodb changes

## Pull Requests
When doing any pull requests, please PR into pretesting.
