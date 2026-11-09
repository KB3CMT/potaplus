#!/usr/bin/perl
use strict;
use warnings;
$|=1;

my $VER = '1.09.00';

=pod
HAM-APPS-PROXY  --  a HTTP => TCP/UDP/other proxy for Ham Radio applications.

Provide easy HTTP endpoints to hit various interfaces.

Author: David Westbrook K2DW
Contact: dwestbrook@gmail.com or K2DW on POTA Slack workspace.

Support: Direct message or #proj-potaplus-browser-extension channel on POTA Slack workspace

Source & Documentation:
	https://dwestbrook.net/projects/potaplus
=cut

=pod

Wire contract (do not change URL paths or query params):
  GET /version
  GET /capabilities          (1.09.00+; older proxies 404 this)
  GET /aclog/<CMD>?...       official K2DW markup
  GET /aclog/?NN:<CMD>...    WD4DAN raw keys
  GET /dxlab/dxkeeper/{log,ping}?...
  GET /dxlab/commander/{CmdSetFreqMode,ping}?...
  GET /log4om/{log,ping}?...
  GET /logger32/{log,qsy,ping}?...
  GET /omnirig/qsy?freq=&mode=
  GET /pst?QRA=  (or AZIMUTH=)
  GET /ping?__host&__port&__proto
  Shared overrides: __host, __port  (and __proto on /ping)

To add a logger or rig backend:
  1. Add a row to %BACKENDS (path, proto, default port, ping).
  2. Add the path to %dispatch pointing at a resp_* sub.
  3. Implement resp_* using cgi_target() + writeINET() (or COM).
  4. Add a builder in the POTA Plus include/potaplus-proxy.js registry
     and an <option> in options.html.

Rebuild the exe (Windows, Strawberry Perl 5.42 + PAR::Packer). No new CPAN
modules versus 1.08.03. Win32::OLE is Windows-only (optional at runtime so
this script will start on other OS for tests). Getopt::Long is core.

  cpanm PAR::Packer
  cpanm Win32::OLE
  cpanm IO::Socket::Timeout
  cpanm HTTP::Server::Simple::CGI
  pp -o ham-apps-proxy.exe -M IO::Socket::INET -M IO::Socket::Timeout -M Errno -M CGI -M HTTP::Server::Simple::CGI -M Win32::OLE -M JSON -M Data::Dumper -M Getopt::Long ham-apps-proxy.pl

Run:
  ham-apps-proxy.exe
  ham-apps-proxy.exe 8073
  ham-apps-proxy.exe --listen 0.0.0.0 8073

Default bind is 127.0.0.1 (loopback). Use --listen 0.0.0.0 for a LAN-hosted
proxy. Stop with Ctrl+C. The process stays in the foreground (no fork).
=cut

use Getopt::Long qw(GetOptions);

our $HAS_WIN32_OLE;
BEGIN {
  if ($^O eq 'MSWin32') {
    eval 'use Win32::OLE';
    $HAS_WIN32_OLE = $@ ? 0 : 1;
    warn "Win32::OLE not available: $@\n" if $@;
  }
}

{
  package MyWebServer;

  use HTTP::Server::Simple::CGI;
  use base qw(HTTP::Server::Simple::CGI);
  use Data::Dumper;
  use IO::Socket::INET;
  use IO::Socket::Timeout;
  use Errno qw(ETIMEDOUT EWOULDBLOCK);
  use JSON;
  use Encode ();

  our $LISTEN_HOST;
  our $LISTEN_PORT;

  use constant WSAETIMEDOUT   => 10060;
  use constant WSAEWOULDBLOCK => 10035;

  # Backend table: path prefix -> transport defaults.
  # Handlers stay explicit because payloads differ (ADIF vs markup vs COM).
  our %BACKENDS = (
    version    => { path => '/version',           proto => undef,  port => undef, ping => 0 },
    capabilities => { path => '/capabilities',    proto => undef,  port => undef, ping => 0 },
    aclog      => { path => '/aclog',             proto => 'tcp',  port => 1100,  ping => 0 },
    dxkeeper   => { path => '/dxlab/dxkeeper',    proto => 'tcp',  port => 52001, ping => 1 },
    log4om     => { path => '/log4om',            proto => 'udp',  port => 2239,  ping => 1 },
    logger32   => { path => '/logger32',          proto => 'tcp',  port => 52001, ping => 1 },
    commander  => { path => '/dxlab/commander',   proto => 'tcp',  port => 52002, ping => 1 },
    omnirig    => { path => '/omnirig',           proto => 'com',  port => undef, ping => 0 },
    pst        => { path => '/pst',               proto => 'udp',  port => 12000, ping => 0 },
    ping       => { path => '/ping',              proto => 'tcp',  port => 52001, ping => 1 },
  );

  my %dispatch = (
    '/version'          => \&resp_version,
    '/capabilities'     => \&resp_capabilities,
    '/aclog'            => \&resp_aclog,
    '/dxlab/dxkeeper'   => \&resp_dxkeeper,
    '/log4om'           => \&resp_log4om,
    '/logger32'         => \&resp_logger32,
    '/dxlab/commander'  => \&resp_commander,
    '/omnirig'          => \&resp_omnirig,
    '/pst'              => \&resp_pst,
    '/ping'             => \&resp_ping,
  );

  my $OMNIRIG;
  my $OMNIRIG_KEY;

  sub cors_headers {
    return (
      -Access_Control_Allow_Origin  => '*',
      -Access_Control_Allow_Methods => 'GET, POST, OPTIONS',
      -Access_Control_Allow_Headers => '*',
    );
  }

  sub handle_request {
    my $self = shift;
    my $cgi  = shift;

    my $method = $ENV{REQUEST_METHOD} || 'GET';
    if (uc($method) eq 'OPTIONS') {
      print $cgi->header(
        -type   => 'text/plain',
        -nph    => 1,
        -status => '204 No Content',
        cors_headers(),
      );
      return;
    }

    my $path = $cgi->path_info();
    my $handler;
    while (!$handler && $path) {
      $handler = $dispatch{$path};
      last unless $path =~ m#/#;
      $path =~ s#/[^/]*$##;
    }

    if (ref($handler) eq 'CODE') {
      my ($ok, $output, $errors) = eval { $handler->($cgi) };
      print $cgi->header(
        -type   => 'application/json',
        -nph    => 1,
        -status => ($ok ? 200 : 500),
        cors_headers(),
      );
      no warnings 'uninitialized';
      print JSON::encode_json({
        success   => $ok ? 1 : 0,
        path_info => $cgi->path_info(),
        error     => $ok ? undef : $@ . $errors,
        data      => $output,
      });
    }
    else {
      print "HTTP/1.0 404 Not found\r\n";
      print "Access-Control-Allow-Origin: *\r\n";
      print "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n";
      print $cgi->header,
            $cgi->start_html('Not found'),
            $cgi->h1('Not found: ' . $cgi->path_info),
            $cgi->end_html;
    }
  }

  sub is_sock_timeout {
    my $n = 0 + $!;
    return 1 if $n == ETIMEDOUT || $n == EWOULDBLOCK;
    return 1 if $n == WSAETIMEDOUT || $n == WSAEWOULDBLOCK;
    return 0;
  }

  # ADIF length is bytes. Encode a flagged UTF-8 string first so park names
  # with non-ASCII produce a spec-correct tag.
  sub ADIF {
    my ($k, $v) = @_;
    $v = '' unless defined $v;
    if (utf8::is_utf8($v)) {
      $v = Encode::encode_utf8($v);
    }
    return sprintf '<%s:%d>%s', $k, length($v), $v;
  }

  sub xml_escape {
    my ($v) = @_;
    $v = '' unless defined $v;
    $v =~ s/&/&amp;/g;
    $v =~ s/</&lt;/g;
    $v =~ s/>/&gt;/g;
    $v =~ s/"/&quot;/g;
    return $v;
  }

  # Field values are escaped. Do not pass a whole <CMD><FOO>... blob through
  # this -- wrap that with MARKUPTAG_RAW.
  sub MARKUPTAG {
    my ($k, $v) = @_;
    return sprintf '<%s>%s</%s>', $k, xml_escape($v), $k;
  }

  sub MARKUPTAG_RAW {
    my ($k, $v) = @_;
    return sprintf '<%s>%s</%s>', $k, (defined $v ? $v : ''), $k;
  }

  sub cgi_target {
    my ($cgi, $default_port, $default_host) = @_;
    $default_host = 'localhost' unless defined $default_host && $default_host ne '';
    my %p = $cgi->Vars;
    my $host = delete $p{__host};
    $host = $default_host if !defined $host || $host eq '';
    my $port = delete $p{__port};
    $port = $default_port if !defined $port || $port eq '';
    return ($host, $port, \%p);
  }

  sub path_command {
    my ($cgi) = @_;
    return (split '/', $cgi->path_info)[-1];
  }

  sub user_params {
    my ($cgi) = @_;
    return grep { !/^__/ } $cgi->param;
  }

  sub adif_parameters {
    my ($cgi, $p) = @_;
    my @k = user_params($cgi);
    return '' unless @k;
    my $parameters = join '', map { ADIF($_, $p->{$_}) } @k;
    $parameters .= '<EOR>';
    return $parameters;
  }

  sub adif_wrapped_command {
    my ($command, $cgi, $p) = @_;
    my $parameters = adif_parameters($cgi, $p);
    return unless $parameters;
    return join '', ADIF('command', $command), ADIF('parameters', $parameters);
  }

  # UDP is fire-and-forget (Log4OM ingest, PstRotator command port). Reading
  # the send socket always waited the full 1s timeout (no EOF on datagrams).
  # TCP still reads; a read timeout is not an HTTP error (1.08.x reported
  # success on empty+timeout, and wrongly 500 on data+timeout).
  sub writeINET {
    my ($proto, $host, $port, $msg, $skip_read) = @_;
    my $socket = IO::Socket::INET->new(
      PeerHost => $host,
      PeerPort => $port,
      Proto    => $proto,
      Timeout  => 2,
    );
    warn "[$proto:$host:$port] CANNOT CONNECT: $!" if !$socket;
    return 0, "cannot connect to the server $!" unless $socket;
    IO::Socket::Timeout->enable_timeouts_on($socket);
    $socket->write_timeout(0.5);
    $socket->read_timeout(1.0);

    warn "[$proto:$host:$port] $msg";
    print $socket $msg;

    my $udp = defined $proto && lc($proto) eq 'udp';
    if ($skip_read || $udp) {
      close($socket);
      return 1, '';
    }

    my $response = '';
    $response .= $_ while <$socket>;
    if (is_sock_timeout()) {
      warn "[$proto:$host:$port] read timeout errno=" . (0+$!) . " bytes=" . length($response) . "\n";
    }
    close($socket);
    return 1, $response;
  }

  # TCP: connect to the ham app. UDP: bind-in-use probe (datagram servers
  # do not accept a TCP connect). Always close the probe socket.
  sub ping {
    my ($cgi, $proto, $host, $port, $msg) = @_;
    warn "PING $proto, $host, $port";
    $proto = lc($proto || 'tcp');
    if ($proto eq 'tcp') {
      my $socket = IO::Socket::INET->new(
        PeerHost => $host,
        PeerPort => $port,
        Proto    => 'tcp',
        Timeout  => 0.5,
      );
      my $err = $socket ? '' : $!;
      my $ok  = $socket ? 1 : 0;
      close($socket) if $socket;
      return $ok, "PING $proto, $host, $port", $err;
    }
    my $socket = eval {
      IO::Socket::INET->new(
        LocalHost => $host,
        LocalPort => $port,
        Proto     => $proto,
        Listen    => 7,
        Reuse     => 0,
      );
    };
    my $err = $@;
    my $ok = $err || !$socket ? 1 : 0;
    close($socket) if $socket;
    return $ok, "PING $proto, $host, $port", $err;
  }

  sub resp_ping {
    my $cgi = shift;
    return if !ref $cgi;
    my %p = $cgi->Vars;
    my $host  = delete $p{__host}  || 'localhost';
    my $port  = delete $p{__port}  || 52001;
    my $proto = delete $p{__proto} || 'tcp';
    return ping($cgi, $proto, $host, $port);
  }

  # data remains a JSON *string* so 1.08.x clients that parse data as text
  # still see {"version":"..."}. /capabilities carries a real object.
  sub resp_version {
    my $cgi = shift;
    return if !ref $cgi;
    return 1, qq!{"version":"$VER"}!;
  }

  sub resp_capabilities {
    my $cgi = shift;
    return if !ref $cgi;
    my @backends;
    foreach my $id (sort keys %BACKENDS) {
      my $b = $BACKENDS{$id};
      push @backends, {
        id    => $id,
        path  => $b->{path},
        proto => $b->{proto},
        port  => $b->{port},
        ping  => $b->{ping} ? 1 : 0,
      };
    }
    return 1, {
      version       => $VER,
      udp_skip_read => 1,
      tcp_ping      => 'connect',
      listen        => $MyWebServer::LISTEN_HOST,
      port          => $MyWebServer::LISTEN_PORT,
      backends      => \@backends,
    };
  }

  sub resp_adif_app {
    my ($cgi, $default_port, $proto, $opts) = @_;
    $opts ||= {};
    return if !ref $cgi;
    my $command = path_command($cgi);
    my ($host, $port, $p) = cgi_target($cgi, $default_port);
    return ping($cgi, $proto, $host, $port) if $command eq 'ping';
    my @k = user_params($cgi);
    return if !@k && $opts->{require_params};
    my $msg;
    if ($opts->{wrap_command}) {
      $msg = adif_wrapped_command($command, $cgi, $p);
      return if !$msg;
    }
    else {
      my $parameters = join '', map { ADIF($_, $p->{$_}) } @k;
      $parameters .= '<APP_TAB>' if $opts->{log_app_tab} && $command eq 'log';
      $parameters .= '<EOR>';
      $msg = $parameters;
    }
    return writeINET($proto, $host, $port, $msg);
  }

# http://localhost:8073/dxlab/commander/CmdSetFreqMode?xcvrfreq=14080&xcvrmode=RTTY&preservesplitanddual=N
# ORDER MATTERS for the parameters ... Commander parsing seems strict on the payload order (even though it's ADIF)
  sub resp_commander {
    # http://www.dxlabsuite.com/commander/Commander%20TCPIP%20Messages.pdf
    return resp_adif_app($_[0], 52002, 'tcp', { wrap_command => 1, require_params => 1 });
  }

# http://localhost:8073/dxlab/dxkeeper/log?CALL=P5DX&RST_SENT=599&RST_RCVD=599&FREQ=1.84027&BAND=160M&MODE=CW&QSO_DATE=20170515&TIME_ON=210700&STATION_CALLSIGN=AA6YQ&TX_PWR=1500
  sub resp_dxkeeper {
    #  http://www.dxlabsuite.com/dxkeeper/DXKeeper%20TCPIP%20Messages%20v1.pdf
    return resp_adif_app($_[0], 52001, 'tcp', { wrap_command => 1, require_params => 1 });
  }

# http://localhost:8073/omnirig/qsy?freq=7200000&mode=LSB
  sub resp_omnirig {
    my $cgi = shift;
    return if !ref $cgi;

    my @k = user_params($cgi);
    return if !@k;

    my $objectId = $cgi->param('__host') || '0839E8C6-ED30-4950-8087-966F970F0CAE';
    $objectId =~ s/^\{//;
    $objectId =~ s/\}$//;
    my $rigName = $cgi->param('__port') || 'Rig1';
    unless ($rigName =~ /^Rig[12]$/i) {
      return 0, "OmniRig target_port must be Rig1 or Rig2 (got $rigName)", '';
    }
    $rigName = $rigName =~ /2/i ? 'Rig2' : 'Rig1';
    warn "OmniRig '$rigName' [$objectId]\n";

    unless ($main::HAS_WIN32_OLE) {
      return 0, 'OmniRig requires Windows (Win32::OLE)', '';
    }

    my ($OmniRig, $err) = _omnirig_object($objectId);
    if (!$OmniRig) {
      return 0, $err || 'OmniRig is not running', '';
    }

    my %modes = (
      USB       => 0x02000000,
      LSB       => 0x04000000,
      'DATA-U'  => 0x08000000,
      'DATA-L'  => 0x10000000,
      AM        => 0x20000000,
      FM        => 0x40000000,
      CW        => 0x00800000,
      'CW-U'    => 0x00800000,
      'CW-L'    => 0x01000000,
    );
    $modes{SSB}  = $modes{USB};
    $modes{DATA} = $modes{'DATA-U'};
    my $freq = $cgi->param('freq');
    my $mode = $cgi->param('mode') || 'USB';
    my $modeCode = $modes{$mode};
    warn "\t OmniRig QSY == $freq Hz == $mode ($modeCode)\n";
    eval {
      $OmniRig->$rigName->{Mode}  = $modeCode;
      $OmniRig->$rigName->{FreqA} = $freq;
      1;
    } or do {
      $OMNIRIG     = undef;
      $OMNIRIG_KEY = undef;
      warn Dumper([ $objectId, $rigName, $cgi->path_info, { $cgi->Vars }, $@ ]);
      return 0, join(' | ', $objectId, $rigName, $cgi->path_info), $@;
    };
    return 1, "OmniRig '$rigName' [$objectId]\n";
  }

  sub _omnirig_object {
    my ($objectId) = @_;
    my $key = $objectId || 'default';
    if ($OMNIRIG && $OMNIRIG_KEY && $OMNIRIG_KEY eq $key) {
      my $alive = eval { my $r = $OMNIRIG->{Rig1}; 1 };
      return ($OMNIRIG, undef) if $alive;
      $OMNIRIG     = undef;
      $OMNIRIG_KEY = undef;
    }
    my $obj;
    eval { $obj = Win32::OLE->GetActiveObject('OmniRig.OmniRigX') };
    $obj ||= eval { Win32::OLE->GetActiveObject("{$objectId}") };
    # Start a new instance only if none is running. Do not pass a Quit
    # destructor: undef of the wrapper would shut OmniRig down.
    $obj ||= eval { Win32::OLE->new('OmniRig.OmniRigX') };
    $obj ||= eval { Win32::OLE->new("{$objectId}") };
    if ($obj) {
      $OMNIRIG     = $obj;
      $OMNIRIG_KEY = $key;
      return ($obj, undef);
    }
    return (undef, 'OmniRig is not running and could not be started');
  }
=pod
OMNIRIG CONSTANTS
  PM_UNKNOWN = $00000001;
  PM_FREQ = $00000002;
  PM_FREQA = $00000004;
  PM_FREQB = $00000008;
  PM_PITCH = $00000010;
  PM_RITOFFSET = $00000020;
  PM_RIT0 = $00000040;
  PM_VFOAA = $00000080;
  PM_VFOAB = $00000100;
  PM_VFOBA = $00000200;
  PM_VFOBB = $00000400;
  PM_VFOA = $00000800;
  PM_VFOB = $00001000;
  PM_VFOEQUAL = $00002000;
  PM_VFOSWAP = $00004000;
  PM_SPLITON = $00008000;
  PM_SPLITOFF = $00010000;
  PM_RITON = $00020000;
  PM_RITOFF = $00040000;
  PM_XITON = $00080000;
  PM_XITOFF = $00100000;
  PM_RX = $00200000;
  PM_TX = $00400000;
  PM_CW_U = $00800000;
  PM_CW_L = $01000000;
  PM_SSB_U = $02000000;
  PM_SSB_L = $04000000;
  PM_DIG_U = $08000000;
  PM_DIG_L = $10000000;
  PM_AM = $20000000;
  PM_FM = $40000000;
=cut

# http://localhost:8073/log4om/log?CALL=P5DX&RST_SENT=599&RST_RCVD=599&FREQ=1.84027&BAND=160M&MODE=CW&QSO_DATE=20170515&TIME_ON=210700&STATION_CALLSIGN=AA6YQ&TX_PWR=1500
  sub resp_log4om {
    return resp_adif_app($_[0], 2239, 'udp', { wrap_command => 1 });
  }

# http://localhost:8073/aclog/updateandlog?CALL=WC3N&BAND=20&MODE=FT8&FREQ=14.074&RSTR=599&RSTS=488&GRID=FM19&POWER=100&DATE=2021/04/25&TIMEON=12:34&TIMEOFF=13:03
# http://localhost:8073/aclog/changefreq?value=21.446&suppressmodedefault=TRUE
# http://localhost:8073/aclog/changemode?value=RTTY
  sub resp_aclog {
    # http://www.n3fjp.com/help/api.html
    my $cgi = shift;
    return if !ref $cgi;

    my $command = uc(path_command($cgi));
    my @k = user_params($cgi);
    my ($host, $port, $p) = cgi_target($cgi, 1100);
    my $proto = 'tcp';

    my $has_raw_cmd_keys = 0;
    foreach my $key (keys %$p) {
      next if $key eq 'keywords';
      if ($key =~ /<CMD>/i || $key =~ /^\d+:/) {
        $has_raw_cmd_keys = 1;
        last;
      }
    }
    my $k2dw_path = $command && $command ne 'ACLOG' && $command =~ /^[A-Z][A-Z0-9]*$/;

    if (!$has_raw_cmd_keys && $k2dw_path) {
      my $parameters = '';
      if ($command eq 'ADDADIFRECORD') {
        $parameters = join '', map { ADIF(uc $_, $p->{$_}) } @k;
        $parameters = MARKUPTAG_RAW('VALUE', $parameters . '<EOR>');
      }
      else {
        $parameters = join '', map { MARKUPTAG(uc($_), $p->{$_}) } @k;
      }
      my $msg = MARKUPTAG_RAW('CMD', '<' . $command . '>' . $parameters) . "\r\n";
      return writeINET($proto, $host, $port, $msg);
    }

    foreach my $cmd (sort keys %$p) {
      next if $cmd eq 'keywords';
      next if !$cmd;
      $cmd =~ s/^\d+\://;
      select(undef, undef, undef, 0.05);
      my ($ok, $response) = writeINET($proto, $host, $port, $cmd, 1);
      return 0, $response if !$ok;
    }
    return 1, '';
  }

# http://localhost:8073/logger32/log?CALL=P5DX&RST_SENT=599&RST_RCVD=599&FREQ=1.84027&BAND=160M&MODE=CW&QSO_DATE=20170515&TIME_ON=210700&STATION_CALLSIGN=AA6YQ&TX_PWR=1500
  sub resp_logger32 {
    # https://www.logger32.net/files/Logger32_v4_User_Manual.pdf	Sections 31 & 32
    return resp_adif_app($_[0], 52001, 'tcp', { wrap_command => 0, log_app_tab => 1 });
  }

# http://localhost:8073/pst?QRA=FN32bt
# http://localhost:8073/pst?AZIMUTH=180
  sub resp_pst {
    my $cgi = shift;
    return if !ref $cgi;

    my @k = user_params($cgi);
    my ($host, $port, $p) = cgi_target($cgi, 12000);
    my $parameters = join '', map { MARKUPTAG(uc($_), $p->{$_}) } @k;
    my $msg = MARKUPTAG_RAW('PST', $parameters) . "\r\n";
    return writeINET('udp', $host, $port, $msg);
  }

} # package

sub print_usage {
  print <<"USAGE";
ham-apps-proxy v$VER

Usage:
  ham-apps-proxy.pl [--listen HOST] [PORT]

  --listen HOST   Bind address. Default 127.0.0.1 (loopback).
                  Use 0.0.0.0 to accept LAN clients.
  PORT            HTTP port. Default 8073. Must be 1-65535.

Stop with Ctrl+C. The server stays in the foreground (no fork).
USAGE
}

my $listen = '127.0.0.1';
my $help   = 0;
GetOptions(
  'listen=s' => \$listen,
  'help|h'   => \$help,
) or do { print_usage(); exit 2; };
if ($help) {
  print_usage();
  exit 0;
}

my $port = shift @ARGV;
if (defined $port && $port ne '') {
  if ($port !~ /^\d+$/ || $port < 1 || $port > 65535) {
    die "Invalid port '$port' (use 1-65535)\n";
  }
}
else {
  $port = 8073;
}

$MyWebServer::LISTEN_HOST = $listen;
$MyWebServer::LISTEN_PORT = $port;

print "ham-apps-proxy v$VER\n";
print "listening on http://$listen:$port/  (Ctrl+C to stop)\n";
print "LAN bind: --listen 0.0.0.0\n" if $listen eq '127.0.0.1' || $listen eq 'localhost';

my $server = MyWebServer->new($port);
$server->host($listen);
# Foreground on every OS. HTTP::Server::Simple->background() forks; on
# Windows that is a pseudo-process and PAR-packed exe + fork is unreliable.
$server->run();
