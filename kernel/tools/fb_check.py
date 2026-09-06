#!/usr/bin/env python3
"""Boot the aarch64 kernel, screenshot the display, and check the pixels.

The kernel already reads its own framebuffer back and reports whether the
pattern is there. That proves the memory is writable and holds what was
written; it does not prove the memory is *the screen*. Only asking the
machine for a picture proves that QEMU accepted the ramfb configuration and
is scanning out that region — so this checks the half the kernel cannot.

The expected coordinates and colours are the ones main_aarch64.zig draws.
They are repeated here on purpose: a check that read its expectations from
the thing under test would agree with any picture at all.
"""

import os
import re
import socket
import subprocess
import sys
import tempfile
import time

WIDTH, HEIGHT = 1024, 768
SLATE = (0x11, 0x1A, 0x20)
SIGNAL = (0x0E, 0x6F, 0x9E)
PATCH, PATCH_Y = 120, 240
PATCHES = [
    (112, (0xFF, 0x00, 0x00)),
    (288, (0x00, 0xFF, 0x00)),
    (464, (0x00, 0x00, 0xFF)),
    (640, (0xFF, 0xFF, 0xFF)),
]

BOOT_MARKER = "ClarityOS aarch64: EL1 boot ok"


def read_ppm(path):
    with open(path, "rb") as f:
        data = f.read()
    # P6 <w> <h> <max>, whitespace-separated, then raw RGB triples.
    m = re.match(rb"P6\s+(\d+)\s+(\d+)\s+(\d+)\s", data)
    if not m:
        raise SystemExit("fb_check: %s is not a binary PPM" % path)
    w, h, maxv = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if maxv != 255:
        raise SystemExit("fb_check: unexpected max value %d" % maxv)
    return w, h, data[m.end():]


def pixel(px, w, x, y):
    off = (y * w + x) * 3
    return tuple(px[off:off + 3])


def wait_for_marker(log_path, deadline):
    while time.time() < deadline:
        try:
            with open(log_path, "r", errors="replace") as f:
                if BOOT_MARKER in f.read():
                    return True
        except FileNotFoundError:
            pass
        time.sleep(0.25)
    return False


def screendump(sock_path, out_path, deadline):
    s = socket.socket(socket.AF_UNIX)
    while True:
        try:
            s.connect(sock_path)
            break
        except (FileNotFoundError, ConnectionRefusedError):
            if time.time() > deadline:
                raise SystemExit("fb_check: QEMU monitor never appeared")
            time.sleep(0.25)
    s.settimeout(5)
    try:
        s.recv(4096)          # banner
    except socket.timeout:
        pass
    s.sendall(("screendump %s\n" % out_path).encode())
    # The monitor echoes the command and prints any error; give it a moment
    # and then judge by whether the file arrived, which is unambiguous.
    time.sleep(2)
    try:
        s.recv(65536)
    except socket.timeout:
        pass
    s.close()


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: fb_check.py <kernel-elf>")
    kernel = sys.argv[1]
    tmp = tempfile.mkdtemp(prefix="clarityfb-")
    log = os.path.join(tmp, "serial.log")
    sock = os.path.join(tmp, "mon.sock")
    shot = os.path.join(tmp, "screen.ppm")

    qemu = subprocess.Popen([
        "qemu-system-aarch64",
        "-M", "virt",
        "-cpu", "cortex-a72",
        "-m", "512",
        "-kernel", kernel,
        "-device", "ramfb",
        "-serial", "file:" + log,
        "-display", "none",
        "-monitor", "unix:%s,server,nowait" % sock,
        "-no-reboot",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)

    failures = []
    try:
        deadline = time.time() + 120
        if not wait_for_marker(log, deadline):
            raise SystemExit("fb_check: kernel never reached the boot marker")
        screendump(sock, shot, deadline)
        if not os.path.exists(shot):
            raise SystemExit(
                "fb_check: QEMU produced no screenshot — it has no display "
                "surface, which means the ramfb configuration was rejected")

        w, h, px = read_ppm(shot)
        if (w, h) != (WIDTH, HEIGHT):
            failures.append("screen is %dx%d, expected %dx%d" % (w, h, WIDTH, HEIGHT))
        else:
            checks = [("border", 4, 4, SIGNAL),
                      ("background", WIDTH // 2, HEIGHT - 64, SLATE)]
            for x, colour in PATCHES:
                checks.append(("patch@%d" % x, x + PATCH // 2, PATCH_Y + PATCH // 2, colour))
            for name, x, y, want in checks:
                got = pixel(px, w, x, y)
                if got != want:
                    failures.append("%s at (%d,%d): got #%02X%02X%02X, want #%02X%02X%02X"
                                    % ((name, x, y) + got + want))
    finally:
        qemu.terminate()
        try:
            qemu.wait(timeout=10)
        except subprocess.TimeoutExpired:
            qemu.kill()

    if failures:
        print("FAIL: the display is not showing what the kernel drew")
        for f in failures:
            print("  " + f)
        return 1
    print("PASS: %dx%d, border, background and four colour patches all correct" % (WIDTH, HEIGHT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
