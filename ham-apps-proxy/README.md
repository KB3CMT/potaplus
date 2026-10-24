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
