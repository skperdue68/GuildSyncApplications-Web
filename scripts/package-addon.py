"""Build the distributable from an existing GuildSyncApplications source folder.

Usage: python scripts/package-addon.py /path/to/GuildSyncApplications
The build requires Python; running the web server does not.
"""
from pathlib import Path
import sys
import zipfile

source = Path(sys.argv[1]).resolve()
output = Path(__file__).resolve().parents[1] / 'public' / 'downloads' / 'GuildSyncApplications.zip'
files = {name: (source / name).read_bytes() for name in ('GuildSyncApplications.lua', 'GuildSyncApplications.txt')}
files['README.txt'] = b'''GuildSyncApplications 1.4.3 - standalone ESO add-on

1. Close ESO. Extract the GuildSyncApplications folder into:
   Documents/Elder Scrolls Online/live/AddOns/
   The result should be AddOns/GuildSyncApplications/GuildSyncApplications.txt.
2. Install LibAddonMenu-2.0 separately (for example, using Minion).
3. Start ESO and enable GuildSyncApplications and its dependency in Add-Ons.
   No GuildSync desktop client, backend server or Discord bot is required.
4. The add-on creates its saved settings after you log in and log out.
   To edit those settings, use the Welcome Studio and download its Lua file.
   With ESO closed, back up and replace:
   Documents/Elder Scrolls Online/live/SavedVariables/GuildSyncApplications.lua
   The downloaded settings file belongs in SavedVariables, not AddOns.

This ZIP contains add-on software only, with no player accounts or records.
For an existing installation, do not delete or replace your SavedVariables
when updating the add-on folder. Use /gsa settings for in-game settings.

Original author: @evainefaye
Source: https://github.com/skperdue68/GuildSync/tree/master/ESO/GuildSyncApplications
Bundled version: 1.4.3. LibAddonMenu-2.0 is not included.
'''
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name, content in files.items():
        info = zipfile.ZipInfo('GuildSyncApplications/' + name, date_time=(2026, 10, 27, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, content)
print(f'Built {output.name} ({output.stat().st_size} bytes)')
