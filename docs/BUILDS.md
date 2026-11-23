# Creating Builds

You can create builds for all platforms by running:

```
yarn build
```

**Note**: This will not work on Windows machines, you will need to manually delete the `dist/` directory and run:

```bash
yarn build:windows
```

The build process copies assets from the `public/` directory into `build/` via `react-scripts`, `electron-builder` picks up assets from the `build/` directory to bundle into native applications.

## Signing and Notarizing Builds (Mac)

By default, Stethoscope builds will **not** notarize your application. If you would like notarized builds, follow the instructions below:

1. Register as an Apple developer
2. Purchase a code-signing certificate and download the PFX bundle
3. Install your code signing certificate to the Mac certificate store
4. Do one of the following:
  a. Generate an app-specific password for the Apple ID that will be used to [notarize](https://developer.apple.com/news/?id=06032019i) the app. (so you don’t have use your regular password!)
  b. [Generate a `jwt` from Apple](https://github.com/electron/electron-notarize/blob/master/README.md#notes-on-jwt-authentication)
5. Add the following environment variables by running:

    ```
    export APP_BUNDLE_ID="com.example-company.stethoscope-local"

    // if using apple id username/password
    export APPLE_ID="my-apple-id-email@example.com"
    export APPLE_ID_PASS="The app-specific password"

    // if using a jwt
    export APPLE_API_KEY='myapikey'
    export APPLE_API_ISSUER='myissuer'

    // optional
    export ASC_PROVIDER='myascprovider'
    ```

6. Sign and notarize the app by running:

    ```bash
    yarn build:mac
    ```

More info about notarizing is available from Apple at [https://developer.apple.com/documentation/xcode/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow](https://developer.apple.com/documentation/xcode/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow)

## Signing Builds (Windows)

Windows builds are signed on a Windows machine with the code-signing
certificate on the USB hardware token. The certificate's private key never
leaves the token: there is no PFX file and no password in the build.

1. Install the token software (SafeNet Authentication Client) and the Windows
   SDK, which provides `signtool.exe`. If signtool is somewhere else, set
   `SIGNTOOL_PATH` to it.
2. Plug in the token. In SafeNet Authentication Client turn on "single logon"
   (Advanced View > Client Settings), so the PIN is asked once per build
   instead of once per file.
3. Find the certificate's SHA-1 thumbprint:

    ```powershell
    Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Format-List Subject,Thumbprint
    ```

4. Build:

    ```powershell
    $env:SHA1KEY = "<thumbprint>"
    yarn build:windows
    ```

electron-builder calls `scripts/windowsSign.js` for every file it signs,
after it has finished editing that file: `DrSprinto.exe`, the Electron DLLs,
`bitlocker-status.exe` and its DLLs, `elevate.exe`, the installer and the
uninstaller. Each is signed with SHA-256 and timestamped. A signing failure
fails the build.

To check the result:

```powershell
signtool verify /pa /v "dist\win-unpacked\DrSprinto.exe"
signtool verify /pa /v "dist\win-unpacked\ffmpeg.dll"
signtool verify /pa /v "dist\DrSprinto Setup <version>.exe"
```

## Replacing configuration values before build

You can manually change values in `package.json` and `src/config.json` before each build.

Or you can set the following environment variables before build to overwrite the files automatically.

All environment variables are optional and if not present it will use the default values.

## Available environment variables

```
export APP_NAME=Stethoscope-My-Company
export APP_PUBLISH_URL="https://some-other-server.example.com/stethoscope/"
export APP_VERSION_SUFFIX="-my-company.1"
export APP_BUNDLE_ID=com.example.com.stethoscope-local
export APP_HELP_SLACK_LINK="slack://channel?team=<my-team>&id=<channel-id>"
export APP_HELP_EMAIL=support@example.com
export APP_ALLOW_PRERELEASE_UPDATES=true
```

# Supporting Automatic Updates

**NOTE: You will need to codesign Mac and Windows builds for automatic updates to work on either platform**

There are quite a few options in the `electron-builder` docs for automatic updates and we suggest you pick one that is best suited for your organization -  [autotmatic update documentation](https://www.electron.build/configuration/publish).

We use S3 internally as a generic file server and manually deploy the assets (though electron-builder can be configured to push builds to S3), the setup process is essentially:

1. Create a public S3 bucket
2. Ensure that `build.publish` is pointed to your S3 bucket in `package.json`

```javascript
"publish": [
  {
    "provider": "generic",
    "url": "https://s3-us-west-2.amazonaws.com/your-public-s3-bucket/"
  }
]
```
3. Build and sign app(s)
4. Upload signed build artifacts (`dist/*.{dmg,exe,blockmap,yml,zip}`) to S3

Once that is in place, the app's "Check for updates" link in the menu will download new versions and prompt the user to restart.
