# ham-apps-proxy review

Review of K2DW's Windows-only local proxy (`src/ham-apps-proxy.pl`), against the
published 1.08.01 behavior used by POTA Plus (port 8073, JSON envelope, Win32::OLE
for OmniRig, TCP/UDP bridges for the other apps).

1.08.02 was the packed rebuild of that script with the socket `close`s (C1/C2)
and `$VER` bumped so `/version` returns 1.08.02. 1.08.03 keeps those closes,
adds dual `/aclog` (official K2DW path commands plus WD4DAN raw-CMD keys) and
an optional `writeINET` `skip_read` used only by the WD4DAN ACLog loop.
1.09.00 is source-only in this tree (no packed exe yet): same URL paths as
1.08.03, plus the structural fixes below. The official K2DW 1.08.01 zip, the
1.08.02 packed rebuild, the 1.08.03 packed rebuild, and the standalone wd4dan
zip are still stored. Findings B1–B12 and P1–P6 originally described 1.08.01;
the table marks what 1.09.00 changed.

POTA Plus mostly issues `fetch` to `http://localhost:8073/...` (host permissions
cover localhost). Logging ping uses `response.ok` (HTTP status). QSY/log bodies
are not parsed for `success` / `data` today, but the JSON envelope is still the
external API.

## 1.09.00

| ID | Was | 1.09.00 |
| --- | --- | --- |
| P1 | UDP Log4OM / PstRotator waited the full 1s read timeout | UDP send, close, return success. JSON `data` still `""`. |
| B1 | `background()` / Win32 fork in packed exe | `run()` foreground, Ctrl+C to stop. |
| B2 / B3 | inverted timeout test; Errno vs Winsock | Read timeout is not HTTP 500. Winsock 10060/10035 counted. Empty+timeout stays success (1.08.x compat for no-reply TCP). |
| B4 | OmniRig `eval or do`, CLSID, `Quit` destructor | ProgID `OmniRig.OmniRigX`, no Quit, cached object, Rig1/Rig2 only. |
| B5 | bind all interfaces + CORS `*` | Default bind `127.0.0.1`; `--listen 0.0.0.0` for LAN. CORS `*` kept. |
| B6 | ADIF `length` in characters | UTF-8 encode then byte length. |
| B7 | markup field values unescaped | Field values XML-escaped. CMD wrappers stay raw. |
| B11 | `/version` `data` is a JSON string | Unchanged (wire compat). `/capabilities` carries a real object. |
| B12 | 404 had no CORS | CORS on 404 and OPTIONS. |
| P4 | new OmniRig COM object every QSY | Cached, dropped on error. |
| C1 / C2 | ping / writeINET `close` | Kept. TCP ping is now connect (still closes). |

Left as-is (low value or needs a ham-app on the box):

- B8 Logger32 default port 52001 (override with `__port` / Options)
- B9 OmniRig SSB = USB
- B10 empty handler return → HTTP 500
- P2 TCP read still waits up to 1s if the peer keeps the socket open
- P3 no connection pool
- P5 / P6 JSON encode and single-threaded HTTP are noise next to P1

## Changed in 1.08.03 (still true)

| ID | Severity | What | Why it matters |
| --- | --- | --- | --- |
| C1 | High | `ping` now `close`s the probe socket | A **failed** ping (target port free) used `IO::Socket::INET` with `LocalPort` + `Listen` to bind the ham app's port. The original never closed that socket, so the proxy could occupy DXKeeper 52001 / Log4OM 2239 / Logger32 until GC and block the real app from starting. HTTP result is unchanged. |
| C2 | Low | `writeINET` now `close`s after the read / timeout check, and on the `skip_read` path | The original had `close($socket)` commented out. |
| C3 | — | Dual `/aclog` | Official K2DW path commands keep the markup/`writeINET` (read) path. Otherwise, or when query keys look like WD4DAN raw `<CMD>` keys (`NN:` prefixes), Dan's sorted-key loop is used. |
| C4 | — | `writeINET(..., $skip_read)` | WD4DAN ACLog loop sets this. 1.09.00 also skip-reads every UDP send. |

## Windows follow-up

1. Run `perl src/ham-apps-proxy.pl` and the packed `ham-apps-proxy.exe`. Confirm 8073 stays up after the banner (B1 / `run()`).
2. Pack 1.09.00 on Strawberry Perl 5.42 + PAR::Packer (`pp` line in README.md). Confirm `/version` is 1.09.00.
3. With DXKeeper/Logger32/Log4OM **stopped**, `GET /dxlab/dxkeeper/ping` (and Log4OM/Logger32 ping). Confirm the target port is free afterward (`netstat`).
4. Log4OM log and PstRotator QRA: wall time of the HTTP request (expect well under 1s; P1).
5. OmniRig: QSY with OmniRig already running, then with it closed. It must not exit after QSY (B4).
6. 1.08.03 remains the last packed zip until 1.09.00 is rebuilt (`releases/ham-apps-proxy-1.08.03.zip`).
