# POTA Plus

A Chrome extension that adds hunter tools on [pota.app](https://pota.app/) (and next.pota.app): QSY, logging via ham-apps-proxy, region-filter presets, n-fer auto-fill, ADIF STATE/DXCC, keyboard hunt mode, and needed-spot alerts.

POTAPlus was originally written by David Westbrook, K2DW. This repository is the getontheair.app build.

**Install:** https://getontheair.app/guide/software/potaplus/

Download the zip, unzip it, and Load unpacked on the `potaplus` folder that contains `manifest.json`. See `releases/INSTALL.txt`.

QSY and logging on Windows go through [ham-apps-proxy](ham-apps-proxy/) (K2DW lineage; source 1.09.00, last packed exe 1.08.03), a local HTTP proxy on port 8073. The 1.11.2 extension talks the 1.08.x URL paths, so a new proxy still serves existing installs and a new extension still talks to 1.08.03.
