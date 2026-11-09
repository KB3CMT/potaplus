# ham-apps-proxy 1.09.00

A local HTTP proxy that sits on **port 8073** and bridges [POTA Plus](https://getontheair.app/guide/software/potaplus/) to Windows ham apps:

- Rig control: DXLab Commander, OmniRig, ACLog
- Logging: DXLab DXKeeper, Log4OM, Logger32, ACLog
- Rotor: PstRotator

**Original author:** David Westbrook, K2DW  
**Source / docs:** https://dwestbrook.net/projects/potaplus  
**Version:** 1.09.00 (K2DW 1.08.01 + socket closes + dual ACLog + 1.09.00 internals)

Windows is the supported runtime (OmniRig uses `Win32::OLE`). The script will start without Win32::OLE so it can be syntax-checked and smoke-tested on other OS. Release zips through 1.08.03 include a PAR-packed `ham-apps-proxy.exe`. **1.09.00 is source only in this tree** — pack the exe on Windows (below) before shipping.

Default bind is **127.0.0.1**. Use `--listen 0.0.0.0` if the proxy must accept clients on the LAN. `Access-Control-Allow-Origin: *` is unchanged so a LAN-hosted proxy still works with the extension.

The process stays in the **foreground** (`run()`, Ctrl+C to stop). 1.08.x called `background()`, which is a Win32 pseudo-fork and is unreliable in a PAR-packed exe.

## Wire contract

URL paths and query params are the same as 1.08.03, so POTA Plus 1.11.x works against this proxy and a 1.09.00-aware extension still works against 1.08.03 (and 1.08.01 for the official ACLog / DXLab / Log4OM / Logger32 / OmniRig / PstRotator paths).

| Path | Notes |
| --- | --- |
| `GET /version` | `data` is still the JSON *string* `{"version":"1.09.00"}` |
| `GET /capabilities` | **1.09.00+.** Object in `data` (`udp_skip_read`, backend table). Older proxies 404 this; the extension treats that as legacy. |
| `GET /aclog/<CMD>?...` | Official K2DW markup |
| `GET /aclog/?NN:<CMD>...` | WD4DAN raw keys |
| `GET /dxlab/dxkeeper/{log,ping}` | TCP 52001 |
| `GET /dxlab/commander/{CmdSetFreqMode,ping}` | TCP 52002 |
| `GET /log4om/{log,ping}` | UDP 2239, fire-and-forget (no 1s read wait) |
| `GET /logger32/{log,qsy,ping}` | TCP 52001 |
| `GET /omnirig/qsy?freq=&mode=` | COM; `__port` is Rig1 or Rig2 |
| `GET /pst?QRA=` (or `AZIMUTH=`) | UDP 12000, fire-and-forget |
| `GET /ping?__host&__port&__proto` | TCP: connect. UDP: bind-in-use |

Shared overrides: `__host`, `__port` (and `__proto` on `/ping`).

To add a logger or rig: add a row to `%BACKENDS` and a `resp_*` in `src/ham-apps-proxy.pl`, a builder in POTA Plus `include/potaplus-proxy.js`, and an `<option>` in `options.html`.

## 1.09.00 vs 1.08.03

- UDP send no longer waits the 1s socket read timeout (Log4OM, PstRotator)
- `run()` instead of `background()` / fork
- `--listen` (default `127.0.0.1`); port `0` is rejected instead of silently becoming 8073
- OmniRig: `GetActiveObject('OmniRig.OmniRigX')`, no `Quit` destructor, cached COM object, Rig1/Rig2 only
- Read timeout is not turned into HTTP 500; Winsock 10060/10035 counted as timeout
- TCP ping is connect; UDP ping stays bind-in-use (probe socket still closed)
- ADIF length is bytes after UTF-8 encode; markup field values are XML-escaped
- CORS headers on 404 and OPTIONS
- Optional `/capabilities`
- `%BACKENDS` + shared `writeINET` / `resp_adif_app` so a new TCP/UDP ADIF app is a thin wrapper

No new CPAN modules. Extra pack flags vs 1.08.03: `-M Encode -M Getopt::Long` (both core).

## Files

| Path | sha256 | Size |
| --- | --- | --- |
| `src/ham-apps-proxy.pl` (1.09.00 source) | `8d4db6dc9c4620ccd1bd3a1966d66341222dc9cfd01230700c26ac4422bccc34` | 20643 |
| `releases/ham-apps-proxy-1.08.03.zip` (last packed rebuild) | `b6ac5dea1f3473a3088823f68458c181738100230a26e7d839d552dd6c43ce92` | 4693171 |
| `ham-apps-proxy.exe` inside that zip | `96e4dc77a9900de40bf4b0b31d205583a94c4ef32a105887e3847908552469f0` | 10268177 |
| `releases/ham-apps-proxy-1.08.02.zip` (previous packed rebuild) | `27590aae29b1a9a6a5e2f12b3c7f72eb8d6f822605ca7e1a3bd2077b27ffca17` | 4693068 |
| `ham-apps-proxy.exe` inside the 1.08.02 zip | `0f917d1eabfc300339898bdaaa94bf24b168f16cccd58ccf6ca20abf52753d35` | 10267616 |
| `releases/ham-apps-proxy-1.08.01.zip` (official K2DW zip) | `68ff1284e979d4d5aae5ce37355638fdddb56e1c6434be37a11b0220778ec809` | 4122807 |
| `ham-apps-proxy.exe` inside the official zip | `7e2f24992bdeb7b4b6e1bafc54a2ea2051bb5da7d666420b2a9ec9025cc10202` | 8568137 |

The `.pl` inside the 1.08.03 zip is the 1.08.03 script, not 1.09.00. The `.pl` inside the official 1.08.01 zip is the unmodified K2DW script (`d74a92107ba53923ea41601b0522fce073673b31f7a6a3d5fa6146f38489447d`).

`/version` on this source returns 1.09.00. The last packed exe still returns 1.08.03 until it is rebuilt.

## Dual `/aclog`

POTA Plus Options can pick **official K2DW** or **ham-apps-proxy-wd4dan**. Primary 1.09.00 (like 1.08.03) accepts both URL styles on one script/exe:

1. **Official K2DW** — path commands such as `/aclog/updateandlog`, `/aclog/changemode`, `/aclog/changefreq`, `/aclog/sendrigcommand`, `/aclog/ADDADIFRECORD`. Markup / `writeINET` (TCP read + close).
2. **WD4DAN** — query keys are raw `<CMD>...</CMD>` strings, often with `NN:` sort prefixes, e.g. `/aclog/?01:<CMD><ACTION><VALUE>CLEAR</VALUE></CMD>&02:<CMD>...`. Sorted keys, strip leading `NN:`, skip `keywords`, 50 ms pause between commands, send each key as the raw message via `writeINET` with `skip_read`. Stops on the first command that cannot be delivered; returns success after all commands.

If the last path segment is a K2DW-style command (UPDATEANDLOG, CHANGEFREQ, CHANGEMODE, SENDRIGCOMMAND, ADDADIFRECORD, and other single-token path commands; not `ACLOG` itself) **and** the query keys are not raw CMD keys, the official path is used. Otherwise the WD4DAN loop is used.

## Rebuild the exe (Windows)

There is **no** 1.09.00 zip/exe in `releases/` yet. Pack on the Windows machine that owns Strawberry Perl 5.42 + PAR::Packer (KB3CMT-11 for 1.08.03). No new CPAN deps versus 1.08.03.

```
cpanm PAR::Packer
cpanm Win32::OLE
cpanm IO::Socket::Timeout
cpanm HTTP::Server::Simple::CGI
pp -o ham-apps-proxy.exe -M IO::Socket::INET -M IO::Socket::Timeout -M Errno -M CGI -M HTTP::Server::Simple::CGI -M Win32::OLE -M JSON -M Data::Dumper -M Encode -M Getopt::Long ham-apps-proxy.pl
```

On Windows with Strawberry Perl, run `pp` through Strawberry's own perl
(`C:\Strawberry\perl\bin\perl C:\Strawberry\perl\site\bin\pp ...`) if another
perl (for example Git Bash's) is first on PATH.

Confirm `/version` returns 1.09.00. Run `ham-apps-proxy.exe` (or `perl src/ham-apps-proxy.pl`) and point POTA Plus Options at `http://127.0.0.1:8073`.

```
ham-apps-proxy.pl [--listen HOST] [PORT]
ham-apps-proxy.exe --listen 0.0.0.0 8073
```

## Historical WD4DAN build: `src/ham-apps-proxy-wd4dan.pl`

A copy of the 1.08.01 script with a different `/aclog` handler, by Dan, WD4DAN.
Kept as historical/reference and **not modified** in 1.09.00. Primary 1.08.03 / 1.09.00 already include that ACLog path, so the separate wd4dan zip is optional/legacy.

The official 1.08.01 zip above is still K2DW's, unchanged.

What was different in the standalone WD4DAN copy (only `/aclog`):

- Each query **key** is sent to ACLog (TCP 1100) as one raw `<CMD>...</CMD>`
  string, in sorted key order. A leading `NN:` sets the order and is stripped,
  e.g. `/aclog/?01:<CMD><ACTION><VALUE>CLEAR</VALUE></CMD>&02:<CMD>...`.
  A 50 ms pause between commands gives ACLog time to fill its entry form.
- ACLog's reply is not read (no 1 s read timeout per command).
- Returns success after sending every command, or the error at the first
  command it cannot deliver (for example, ACLog not running).

POTA Plus still uses that URL style when **Options > ACLog proxy** (Rig Control
and/or Logging) is set to **ham-apps-proxy-wd4dan (modified)**. With it:

- Logging fills ACLog's entry form field by field (CLEAR, call, frequency, mode,
  date/time, RST, comments, extra `Other1=...`-style fields, ENTER) instead of
  one `UPDATEANDLOG`.
- QSY sends mode, frequency and the TX CLAR commands in one request.

With **official K2DW ham-apps-proxy**, POTA Plus uses the official endpoints
(`/aclog/updateandlog`, `/aclog/changemode`, `/aclog/changefreq`,
`/aclog/sendrigcommand`). Both styles work against primary 1.08.03 and 1.09.00.

### Files

| Path | sha256 | Size |
| --- | --- | --- |
| `src/ham-apps-proxy-wd4dan.pl` | `f935f384e79aa7e9c1337bcc74e23c026ce09e0ebc16082d2c7984caa3aabbfd` | 15293 |
| `releases/ham-apps-proxy-1.08.01-wd4dan.zip` | `9ebad090c2ac30b56213261fde0b4e8e9024b918f79d41a351a8f241fafb7b46` | 4192236 |
| `ham-apps-proxy-wd4dan.exe` inside that zip | `1d5df90c0b1701eeb66332cb05001bd4887117e28aad9228d9bba4fcd1810c95` | 8569289 |

The `.pl` inside the zip matches `src/ham-apps-proxy-wd4dan.pl`. The exe was
built 2026-10-24 with Strawberry Perl 5.32.1 and PAR::Packer, using the `pp`
command above with `ham-apps-proxy-wd4dan.pl` and `-o ham-apps-proxy-wd4dan.exe`.
It runs on port 8073 like the official build, so stop one before starting the
other. Its startup line reads `ham-apps-proxy v1.08.01-wd4dan`.
