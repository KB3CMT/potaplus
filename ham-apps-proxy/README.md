# ham-apps-proxy 1.08.01

A local HTTP proxy that sits on **port 8073** and bridges [POTA Plus](https://getontheair.app/guide/software/potaplus/) to Windows ham apps:

- Rig control: DXLab Commander, OmniRig, ACLog
- Logging: DXLab DXKeeper, Log4OM, Logger32, ACLog
- Rotor: PstRotator

**Original author:** David Westbrook, K2DW  
**Source / docs:** https://dwestbrook.net/projects/potaplus  
**Version:** 1.08.01 (2022-12-05)

Windows-only. The script uses `Win32::OLE` (OmniRig and related COM). The official zip includes a PAR-packed `ham-apps-proxy.exe` so you do not need Perl installed to run it.

These files were downloaded 2026-10-24 from https://dwestbrook.net/projects/potaplus/releases/. The `.pl` and the zip are stored here unchanged.

## Files

| Path | sha256 | Size |
| --- | --- | --- |
| `src/ham-apps-proxy.pl` | `d74a92107ba53923ea41601b0522fce073673b31f7a6a3d5fa6146f38489447d` | 15476 |
| `releases/ham-apps-proxy-1.08.01.zip` (official zip) | `68ff1284e979d4d5aae5ce37355638fdddb56e1c6434be37a11b0220778ec809` | 4122807 |
| `ham-apps-proxy.exe` inside that zip | `7e2f24992bdeb7b4b6e1bafc54a2ea2051bb5da7d666420b2a9ec9025cc10202` | 8568137 |

The `.pl` inside the zip matches `src/ham-apps-proxy.pl`.

## Rebuild the exe (optional)

From the script header, with Perl 5.32 and PAR::Packer:

```
cpanm PAR::Packer
cpanm Win32::OLE
cpanm IO::Socket::Timeout
cpanm HTTP::Server::Simple::CGI
pp -o ham-apps-proxy.exe -M IO::Socket::INET -M IO::Socket::Timeout -M Errno -M CGI -M HTTP::Server::Simple::CGI -M Win32::OLE -MJSON ham-apps-proxy.pl
```

Run the official `ham-apps-proxy.exe` (or the script under Windows Perl) and point POTA Plus Options at `http://127.0.0.1:8073`.

## Modified build: `src/ham-apps-proxy-wd4dan.pl`

A copy of the 1.08.01 script with a different `/aclog` handler, by Dan, WD4DAN.
`src/ham-apps-proxy.pl` and the official zip above are still K2DW's, unchanged.
Diff the two `.pl` files to see every change.

What is different (only `/aclog`):

- Each query **key** is sent to ACLog (TCP 1100) as one raw `<CMD>...</CMD>`
  string, in sorted key order. A leading `NN:` sets the order and is stripped,
  e.g. `/aclog/?01:<CMD><ACTION><VALUE>CLEAR</VALUE></CMD>&02:<CMD>...`.
  A 50 ms pause between commands gives ACLog time to fill its entry form.
- ACLog's reply is not read (no 1 s read timeout per command).
- Returns success after sending every command, or the error at the first
  command it cannot deliver (for example, ACLog not running).

POTA Plus uses this build when **Options > ACLog proxy** (Rig Control and/or
Logging) is set to **ham-apps-proxy-wd4dan (modified)**. With it:

- Logging fills ACLog's entry form field by field (CLEAR, call, frequency, mode,
  date/time, RST, comments, extra `Other1=...`-style fields, ENTER) instead of
  one `UPDATEANDLOG`.
- QSY sends mode, frequency and the TX CLAR commands in one request.

With the default **official K2DW ham-apps-proxy** setting, POTA Plus uses the
official endpoints (`/aclog/updateandlog`, `/aclog/changemode`,
`/aclog/changefreq`, `/aclog/sendrigcommand`).

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

To rebuild it, use that same `pp` command.
On Windows with Strawberry Perl, run `pp` through Strawberry's own perl
(`C:\Strawberry\perl\bin\perl C:\Strawberry\perl\site\bin\pp ...`) if another
perl (for example Git Bash's) is first on PATH.
