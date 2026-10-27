# ham-apps-proxy 1.08.01 review

Review of K2DW's Windows-only local proxy (`src/ham-apps-proxy.pl`), against the
published 1.08.01 behavior used by POTA Plus (port 8073, JSON envelope, Win32::OLE
for OmniRig, TCP/UDP bridges for the other apps).

1.08.02 was the packed rebuild of that script with the socket `close`s (C1/C2)
and `$VER` bumped so `/version` returns 1.08.02. 1.08.03 keeps those closes,
adds dual `/aclog` (official K2DW path commands plus WD4DAN raw-CMD keys) and
an optional `writeINET` `skip_read` used only by the WD4DAN ACLog loop.
The official K2DW 1.08.01 zip, the 1.08.02 packed rebuild, and the standalone
wd4dan zip are still stored. 1.08.03 is packed as
`releases/ham-apps-proxy-1.08.03.zip` (KB3CMT-11). Findings below for B1–B12
and P1–P6 are unchanged.

POTA Plus mostly issues `fetch` to `http://localhost:8073/...` (host permissions
cover localhost). Logging ping uses `response.ok` (HTTP status). QSY/log bodies
are not parsed for `success` / `data` today, but the JSON envelope is still the
external API.

## Changed in this tree

| ID | Severity | What | Why it matters |
| --- | --- | --- | --- |
| C1 | High | `ping` now `close`s the probe socket | A **failed** ping (target port free) used `IO::Socket::INET` with `LocalPort` + `Listen` to bind the ham app's port. The original never closed that socket, so the proxy could occupy DXKeeper 52001 / Log4OM 2239 / Logger32 until GC and block the real app from starting. HTTP result is unchanged. |
| C2 | Low | `writeINET` now `close`s after the read / timeout check, and on the `skip_read` path | The original had `close($socket)` commented out. DESTROY usually reclaims the handle, but a long-running server plus `IO::Socket::Timeout`'s Win32 PerlIO layer is a leak risk. `$`! is still sampled **before** `close`. A socket that was opened is always closed (C1/C2). |
| C3 | — | Dual `/aclog` | Official K2DW path commands (`/aclog/updateandlog`, `/aclog/changefreq`, `/aclog/changemode`, `/aclog/sendrigcommand`, `/aclog/ADDADIFRECORD`, and other single-token path commands) keep the 1.08.02 markup/`writeINET` (read) path. Otherwise, or when query keys look like WD4DAN raw `<CMD>` keys (`NN:` prefixes), Dan's sorted-key loop is used. |
| C4 | — | `writeINET(..., $skip_read)` | When set, write, `close`, return success without reading. The WD4DAN ACLog loop sets this so multi-command requests do not pay a 1 s timeout each. DXKeeper, Commander, Log4OM, Logger32, PstRotator, and official ACLog path commands still read. |

## Bugs not changed

### B1 — High — `background()` on Windows

Last lines:

```
my $pid = MyWebServer->new($port)->background();
```

`HTTP::Server::Simple->background` is `fork` then `run` in the child. On Windows,
Perl `fork` is a pseudo-process (thread in the same OS process). `exit` in the
parent can tear the whole process down; PAR-packed exe + fork is a known
minefield.

The published `.exe` has been used in the wild, so this may accidentally work
(parent teardown blocking on the server thread, console stays up). It is still
fragile. An independent later fork of this script switched to `->run()`.

**Do not change without launching the `.pl` and the official `.exe` on Windows
and confirming the process keeps listening on 8073 after the banner prints.**

If `background()` is actually dying, the fix is `->run()` on MSWin32 (foreground
console, Ctrl+C stops it). That is a UX change only if daemonizing truly worked.

### B2 — Medium — timeout test is inverted vs the module docs

`writeINET` copies the `IO::Socket::Timeout` synopsis but drops the `!`:

```
# IO::Socket::Timeout docs (intended):
if (! $response && ( 0+$! == ETIMEDOUT || 0+$! == EWOULDBLOCK )) { ... }

# 1.08.01:
if ( $response && ( 0+$! == ETIMEDOUT || 0+$! == EWOULDBLOCK ) ) { ... }
```

As written:

- Empty read + timeout (UDP fire-and-forget, TCP that never replies) reports
  **success**.
- Partial/complete read + timeout (TCP peer that sends a reply but does not
  close, or UDP that *does* reply) reports **HTTP 500** `"timeout reading on
  the socket"`.

Flipping the `!` without also special-casing UDP would make Log4OM and PstRotator
return 500 on every command (they do not reply on the send socket). Left
unchanged.

### B3 — Medium — `Errno` vs Winsock on Windows

On Linux/FreeBSD/macOS, `IO::Socket::Timeout` uses `SO_RCVTIMEO`. On Windows it
installs `PerlIO::via::Timeout` and is supposed to set `$!` to `ETIMEDOUT` /
`EWOULDBLOCK`. Perl's `Errno::ETIMEDOUT` is the CRT value, not necessarily
`WSAETIMEDOUT` (10060). If those do not match, **the timeout `if` never fires**
and every command "succeeds" after the read timeout. That would explain why B2
has been tolerable in production.

Worth printing `0+$!` after a known timeout on the Perl that packs the exe.

### B4 — Medium — OmniRig `eval { ... } or do` + `Quit` destructor

`resp_omnirig` is `eval { ... return 1, $msg } or do { return 0, ... }`.
`or` forces **scalar** context on the `eval`, so a list return collapses to its
last element. Combined with `return` inside the eval (returns from the eval, not
the sub):

- `Win32::OLE->GetActiveObject("{$objectId}")` is a CLSID in braces, not the
  ProgID `OmniRig.OmniRigX`. It may still resolve; it is not the usual call.
- Default `Win32::OLE` does not croak on failure (`Warn` is not set to 3/4), so
  "not running" is often `undef` + empty `$@`, not an exception.
- `Win32::OLE->new(..., sub { $_[0]->Quit })` then `undef $OmniRig` will call
  `Quit` on a newly started instance. OmniRig may not implement `Quit`; if it
  does, QSY could **shut OmniRig down** when it was not already running.
- `$OmniRig->$rigName->{Mode}` interpolates `__port` as a method name (`Rig1` /
  `Rig2`). A numeric logger port accidentally passed as `target_port` will fail.

COM is STA; `fork`/`background` on Win32 makes apartment rules even less
predictable. Needs a box with OmniRig installed.

### B5 — Medium — listens on every interface

`HTTP::Server::Simple` default host is `undef` (all addresses), plus
`Access-Control-Allow-Origin: *`. Anyone who can open TCP 8073 can QSY, log QSOs,
or move a rotor. POTA Plus defaults to `localhost`. Binding `127.0.0.1` would be
safer but would break a LAN-hosted proxy. Not changed.

### B6 — Low — ADIF `length($v)` vs bytes

`ADIF` uses Perl `length`. Flagged UTF-8 strings (park names / comments with
non-ASCII) count characters, not bytes. ADIF length is defined in bytes. Can
emit a tag the logger rejects. Not changed (payload change).

### B7 — Low — markup values are not escaped

`MARKUPTAG` drops `$v` into XML with no encoding of `<` `&`. ACLog comments and
PstRotator fields can break the envelope. N3FJP samples in the comments also omit
a close tag on the command; that matches 1.08.01 and was left alone.

### B8 — Low — Logger32 default port 52001

Same default as DXKeeper. Logger32's ADIF TCP port is user-configured; 52001 is
almost certainly a copy-paste. Options `target_port` overrides it. Not changed.

### B9 — Low — OmniRig SSB is always USB

`$modes{SSB} = $modes{USB}` with no band split. Commander has a commented
freq-based USB/LSB line. POTA Plus usually sends USB/LSB/DATA-U itself. Not
changed.

### B10 — Low — empty handler return becomes HTTP 500

`return if !ref $cgi` and commander/dxkeeper `return if ! scalar @k` yield
`undef` in the JSON wrapper (`success: 0`, empty `error`). Not a current POTA
Plus URL shape.

### B11 — Low — `/version` double-encodes JSON

`data` is the string `'{"version":"1.08.03"}'` (tracks `$VER`; was `1.08.01`
upstream), not an object. Same double-encoded shape as the original API.

### B12 — Low — 404 has no CORS header

Unmatched paths print `HTTP/1.0 404` + HTML without
`Access-Control-Allow-Origin`. Fine for same-origin-permission fetches that 200.

## Performance (not changed)

### P1 — High impact — UDP commands wait the full read timeout

`writeINET` is used for Log4OM (UDP 2239) and PstRotator (UDP 12000). After
`print` it does `$response .= $_ while <$socket>` with `read_timeout(1.0)`.
UDP has no EOF, so this always waits ~1s. PstRotator replies on **port+1**, not
the send socket, so the read never sees AZ. Log4OM's UDP ingest is fire-and-forget.

POTA Plus already delays logging `ping` by 1s, which matches this stall.
`HTTP::Server::Simple` is **single-threaded**, so that 1s blocks every other
request (including the second ACLog QSY call: `changefreq` then `changemode`).

Safe-looking change (not applied): if `lc($proto) eq 'udp'`, send, close, return
`(1, "")` without reading. JSON for the no-reply case stays `{success:1, data:""}`;
only latency changes. Risk: some other client of this proxy might want a UDP
reply in `data` (POTA Plus does not read it).

### P2 — Medium — TCP read waits for close or 1s

DXKeeper / Commander / ACLog / Logger32: if the app replies and **keeps** the
socket open, the `while <$socket>` loop waits the remaining read timeout. If B2
ever fires, that becomes HTTP 500. A bounded `sysread` (or `shutdown(SHUT_WR)`
then read, as the comments already consider) would cut latency. Behavior change
if an app streams more than one line.

### P3 — Medium — new TCP/UDP socket per request

No connection reuse to ham apps. Appropriate for DXLab's short command sockets;
not worth a pool without measuring those apps.

### P4 — Medium — OmniRig COM object is created and destroyed every QSY

`GetActiveObject` / `new` / `undef` on each `/omnirig/qsy`. Caching one
`OmniRigX` in a package global would cut COM churn. Risk: stale object after
OmniRig restart; need `LastError` checks. Also fights the `Quit` destructor (B4).

### P5 — Low — always load `Data::Dumper` / `JSON` / `Win32::OLE`

Tiny compared with 1s UDP waits. `JSON::encode_json` per request is noise.

### P6 — Low — no Keep-Alive / one HTTP request at a time

Acceptable for a localhost helper. Real concurrency needs a different server
(pre-fork/threads) and is a poor fit for Win32::OLE STA.

## Nice-to-have (not changed)

- `->run()` on Windows; print banner with bind address and how to stop.
- Bind `127.0.0.1` by default; optional `--listen`.
- TCP ping via `connect` (UDP still has to probe bind-in-use).
- `Win32::OLE->GetActiveObject('OmniRig.OmniRigX')` and no `Quit` destructor.
- `OPTIONS` CORS for non-extension browsers.
- `bytes::length` after UTF-8 encoding for ADIF.
- Registry lookup for DXLab ports (commented intent in the header).
- Do not treat `port 0` as "use 8073" (`shift(@ARGV) || 8073`).

## Windows follow-up

1. Run official `ham-apps-proxy.exe` and `perl src/ham-apps-proxy.pl`. Confirm
   8073 stays up after the version banner (B1).
2. With DXKeeper/Logger32/Log4OM **stopped**, `GET /dxlab/dxkeeper/ping` (and
   Log4OM/Logger32 ping). Confirm the target port is free afterward (`netstat`).
   That is the C1 fix.
3. Log4OM log and PstRotator QRA: wall time of the HTTP request (expect ~1s
   today; P1).
4. DXKeeper `log` and Commander `CmdSetFreqMode`: whether the app closes the
   TCP socket, and whether HTTP is 200 or 500 (B2/B3). Log `0+$!` after the read.
5. OmniRig: QSY with OmniRig already running, then with it closed. Watch whether
   OmniRig is launched and then exits (B4 `Quit`).
6. 1.08.03 is the current packed rebuild (`releases/ham-apps-proxy-1.08.03.zip`).
   1.08.02 remains as the previous packed rebuild.
