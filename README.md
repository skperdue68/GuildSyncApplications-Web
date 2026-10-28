# GuildSyncApplications Web · Welcome Studio

A browser editor for GuildSyncApplications welcome chat messages and in-game emails. Built for officers who want more room to write, or cannot open the add-on editor. Uses the same lightweight Node server and shared-library setup as [SmartChatMsg-Web](https://github.com/skperdue68/SmartChatMsg-Web).

## Run

Requires **Node 22 or newer**. There are no runtime package dependencies.

```sh
npm start
```

Open http://127.0.0.1:4174. Try the sample workspace to explore, open your latest SavedVariables, or start a new file for a fresh installation.

## Download the standalone ESO add-on

Choose **Download add-on ZIP** at the top of the page to download `GuildSyncApplications.zip`. It contains the **GuildSyncApplications 1.4.3** add-on Lua file, manifest and installation instructions. Extract its `GuildSyncApplications` folder into `Documents/Elder Scrolls Online/live/AddOns/` and install **LibAddonMenu-2.0** separately (for example through Minion). No GuildSync backend, desktop client or Discord bot is required.

The ZIP is add-on software, without personal account settings. **Download Lua** in the editor instead exports your edited SavedVariables; that file belongs in `live/SavedVariables/`, with ESO closed. Do not put edited SavedVariables into the AddOns folder.

The bundled files originate from [GuildSyncApplications 1.4.3](https://github.com/skperdue68/GuildSync/tree/master/ESO/GuildSyncApplications), Lua blob `b5e13a345ebee5d6ebb453eb5ca2ce57e94b3016` and manifest blob `6ac8a4b8808cc2689d0ca578013ee44036c9e3d7`. Developers can rebuild the ZIP from an add-on source folder with `python scripts/package-addon.py /path/to/GuildSyncApplications`. Python is not needed to run the site or download the bundled ZIP.

## Template identity and duplicate prevention

Templates created by the web editor receive a permanent `webTemplateId`, saved in Lua and retained when imported into another account or customized. The add-on's numeric `id` remains local to each account, avoiding collisions with existing templates. An intentional **Duplicate** creates a new permanent identity.

Starter and server import lists hide templates already in the selected destination account and show how many were hidden. Matching permanent IDs prevent re-adding a template even after its wording changes. Exact chat text or email subject/body matching also prevents duplicates in older files without permanent IDs. Legacy server entries derive a repeatable identity from their source account, category and original entry ID when imported. Deleted templates can be added again.

## Edit and install

1. Open `Documents/Elder Scrolls Online/live/SavedVariables/GuildSyncApplications.lua`. Choose the SavedVariables file; the add-on source has the same filename and is not editable here.
2. Select your ESO account. Welcome chat and welcome emails have separate libraries. Create, edit, duplicate, delete, or enable templates. Optional starter templates come from GuildSyncApplications 1.4.3.
3. Use `{name}` wherever the applicant's ESO account name belongs. The live preview substitutes a sample name. Chat messages must fit **335 UTF-8 bytes**, matching the add-on. Leave room for name expansion; the preview warns when the expanded text is too long. Email subject and body are both required.
4. Choose **Apply changes**. Navigation also applies valid drafts. Invalid drafts stay in the editor until corrected or explicitly discarded. Applying only changes the browser workspace.
5. Choose **Download Lua** to obtain `GuildSyncApplications.lua`. Close ESO, back up the original, and replace the file in SavedVariables. Remove any browser-added suffix such as `(1)` from the filename. Restart ESO.

**Always open the newest SavedVariables after playing ESO.** This version does not merge newer snapshots into an older workspace. Installing an old file can replace newer records and usage history. New files contain no previous application records, so use an existing file when preserving records matters.

Imported unknown fields, other accounts, application records, IDs and usage history are preserved. Edited existing templates keep their history; new and duplicated entries receive fresh IDs and history. Lua is parsed as restricted data and is never executed. Nonstandard, sparse or malformed template lists are rejected instead of silently dropping entries. Comments and whitespace are reformatted on export.

## Shared server library

### Copy someone else's templates into your own file

1. Open **your own** latest `GuildSyncApplications.lua` and select your account.
2. Choose **Import templates from server**, then **Choose templates** beside the saved file you want to borrow from. You can also choose **Import templates** beside a file in the server library.
3. Select the source account and check the welcome messages and emails you want. The dialog names your destination account.
4. Choose **Import selected templates**. Only template wording, titles and enabled state are copied. Your existing templates, application records, other accounts and settings remain in place. Copies receive fresh local IDs and zero usage history; identical chat text or email subject/body pairs are skipped.
5. Edit the imported wording if desired, then **Download Lua** to get your combined file, or save it under a new server name.

For a blank configuration this fills its welcome library without bringing over the writer's account data. **Load from server** continues to open an entire saved file; use **Import templates from server** to merge wording into your own account.

Like SCM-Web, this library has **no logins**. Everyone using the site can load saved files. **Save to server uploads the complete Lua file**, including account names, application records and usage history. The save dialog requires explicit acknowledgement. Opening and editing local files stays in your browser until that action.

- Save under a friendly unique name. Names are case-insensitive; existing saves cannot be overwritten or deleted through the app.
- **Load from server** opens the saved-file library. It is available at the top of the page before opening any file, and beside **Save to server** in the workspace. Choose **Load** next to a saved name to reopen it. Loading opens a browser copy; the server copy remains unchanged.
- Records persist in `data/shared-library`, excluded from Git. Back up this directory and retain it across deployments. Internal `.gsa` files contain metadata and Lua; use **Download Lua** for the installable file.
- `LIBRARY_DIR` changes the storage location. Relative paths resolve from the server working directory. The service user needs write access there.
- Lua uploads are limited to 20 MiB. Shared files are intended for trusted guild users; this app does not provide private storage, accounts, or abuse quotas. Use existing proxy access controls if your server needs restricted access.

## Host alongside SCM-Web

Copy `.env.example` to `.env` in the project folder. Existing process environment variables take precedence. The default port is **4174**, so it can run alongside SCM-Web on 4173.

```dotenv
HOST=127.0.0.1
PORT=4174
PUBLIC_ORIGIN=https://YOUR-GSA-HOSTNAME
LIBRARY_DIR=data/shared-library
```

Configure DNS and HTTPS for the hostname you choose, then point your reverse proxy at `http://127.0.0.1:4174`. Preserve the original Host header. Example Nginx location inside the matching HTTPS server block:

```nginx
location / {
    proxy_pass http://127.0.0.1:4174;
    proxy_set_header Host $host;
    client_max_body_size 40m;
}
```

In Nginx Proxy Manager, use the same upstream port and set `client_max_body_size 40m;` in Advanced if needed. If Node and the proxy run on different machines or containers, set `HOST=0.0.0.0` and use the reachable address; `PUBLIC_ORIGIN` must still match the browser's real origin. Host and Origin checks reject unconfigured domains and cross-origin writes.

Example systemd unit (adjust paths and service user to your server):

```ini
[Unit]
Description=GuildSyncApplications Welcome Studio
After=network.target

[Service]
Type=simple
User=YOUR_SERVICE_USER
WorkingDirectory=/opt/GuildSyncApplications-Web
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
Environment=NODE_ENV=production
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Save as `/etc/systemd/system/gsa-web.service`, then run `sudo systemctl daemon-reload` and `sudo systemctl enable --now gsa-web`. After pulling updates, run `sudo systemctl restart gsa-web`. No deployment changes to SCM-Web are required.

## Development and verification

```sh
npm install
npm test
npm run test:browser
```

The browser check uses installed Chrome on Windows, or Playwright Chromium elsewhere. Set `BROWSER_PATH` to an installed Chromium browser, or run `npx playwright install chromium`. Tests use synthetic accounts and temporary storage, never real player data. Screenshots are written to ignored `browser-temp/`.

The Node tests cover Lua byte preservation, Unicode, unsafe input rejection, account and record preservation, template operations, UTF-8 validation, public-origin rules and shared-library persistence. The browser test exercises previews, chat/email editing, shared save/load, downloads, invalid drafts and a mobile viewport.

Compatible with the settings structure in GuildSyncApplications **1.4.3**. This app edits templates only; it does not send chat or mail, manage guild applications, or fix the in-game settings editor.
