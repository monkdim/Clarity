#!/usr/bin/env python3
"""Boot the aarch64 kernel, type at it, and check what it read.

A driver that comes up and delivers nothing looks exactly like a driver that
comes up and nobody presses anything — so the boot log's "read 0 characters"
is not a failure and cannot be one. This makes the keys happen: QEMU's monitor
has a `sendkey` command, so the test can type.

What it checks is the whole path: the device tree naming thirty-two identical
bus slots, the transport probe finding which one holds a keyboard, the
virtqueue the device writes events into, and the keycode table turning them
into characters. A break anywhere in that gives a different string.
"""

import os
import socket
import subprocess
import sys
import tempfile
import time

READY_MARKER = b"[ok] keyboard: virtio-input"
RESULT_PREFIX = "  keyboard: read "

# What to type. Letters only, because `sendkey` names them the same as the
# characters they produce, so the expected string is the key list — nothing
# in this file has to know the keycode table, which is the thing under test.
# The alphabet twice: fifty-two key presses, which QEMU turns into four
# events each — press, sync, release, sync — so well over two hundred events
# through a queue of sixty-four. That is deliberate. A shorter string fits in
# the ring the driver hands the device at start-up, and would pass whether or
# not buffers are ever given back; this only passes if they are.
#
# Found by typing seven keys and reading back six: the queue was eight deep,
# and "make it bigger" is not a diagnosis, so this is the test that tells the
# two apart.
KEYS = [chr(c) for c in range(ord("a"), ord("z") + 1)] * 2
EXPECTED = "".join(KEYS)


def wait_for(log_path, marker, deadline, proc=None):
    """Wait for `marker` to appear in the log, or for the deadline to pass.

    `proc` is watched too: QEMU dying is a different failure from QEMU never
    getting there, and waiting out the deadline on a process that has already
    exited turns a two-second answer into a two-minute one.
    """
    while time.time() < deadline:
        try:
            with open(log_path, "rb") as f:
                if marker in f.read():
                    return True
        except FileNotFoundError:
            pass
        if proc is not None and proc.poll() is not None:
            return False
        time.sleep(0.1)
    return False


def wait_for_result(log_path, deadline, proc):
    """The kernel's result line, once it is complete.

    Waiting for the marker alone is not enough: the line is built out of
    several console writes and the marker is the first of them, so a read that
    catches it mid-line sees the count and not the characters. The closing
    quote is what says the whole line is there — which is a fact about the
    line rather than a length of time to sleep for.
    """
    while time.time() < deadline:
        try:
            with open(log_path, "rb") as f:
                text = f.read().decode("utf-8", "replace")
            for line in text.splitlines():
                if line.startswith(RESULT_PREFIX) and line.count('"') >= 2:
                    return line
        except FileNotFoundError:
            pass
        if proc.poll() is not None:
            return None
        time.sleep(0.1)
    return None


def monitor(sock_path, deadline):
    s = socket.socket(socket.AF_UNIX)
    while True:
        try:
            s.connect(sock_path)
            break
        except (FileNotFoundError, ConnectionRefusedError):
            if time.time() > deadline:
                raise SystemExit("key_check: QEMU monitor never appeared")
            time.sleep(0.1)
    s.settimeout(5)
    try:
        s.recv(4096)
    except socket.timeout:
        pass
    return s


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: key_check.py <kernel-image>")
    kernel = sys.argv[1]
    tmp = tempfile.mkdtemp(prefix="claritykey-")
    log = os.path.join(tmp, "serial.log")
    sock = os.path.join(tmp, "mon.sock")

    qemu = subprocess.Popen([
        "qemu-system-aarch64",
        "-M", "virt",
        "-cpu", "cortex-a72",
        "-m", "512",
        "-kernel", kernel,
        "-device", "ramfb",
        "-device", "virtio-keyboard-device",
        "-serial", "file:" + log,
        "-display", "none",
        "-monitor", "unix:%s,server,nowait" % sock,
        "-no-reboot",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)

    try:
        # Two deadlines, because there are two waits and only one of them is
        # about this test. Getting as far as the keyboard is most of a boot,
        # and under TCG on a shared runner that is minutes; what happens
        # *after* the keys are sent is seconds. One deadline covering both
        # would have to be generous enough for the boot, which would leave the
        # part being measured with no bound worth having.
        deadline = time.time() + 300
        # Connect before the kernel is ready, so no time is lost afterwards:
        # the kernel stops reading a few seconds after it starts, and that
        # window is what the keys have to arrive in.
        m = monitor(sock, deadline)
        if not wait_for(log, READY_MARKER, deadline, qemu):
            try:
                with open(log, "rb") as f:
                    tail = f.read()[-1200:].decode("utf-8", "replace")
            except FileNotFoundError:
                tail = "(no serial log at all)"
            if qemu.poll() is not None:
                print("FAIL: QEMU exited (%d) before the kernel found a keyboard"
                      % qemu.returncode)
            else:
                print("FAIL: the kernel never found a keyboard")
            print(tail)
            return 1

        for k in KEYS:
            m.sendall(("sendkey %s\n" % k).encode())
            time.sleep(0.05)

        line = wait_for_result(log, time.time() + 60, qemu)
        if line is None:
            print("FAIL: the kernel never reported what it read")
            return 1
    finally:
        qemu.terminate()
        try:
            qemu.wait(timeout=10)
        except subprocess.TimeoutExpired:
            qemu.kill()

    got = line.split('"')[1]
    if got != EXPECTED:
        print("FAIL: typed %r, the kernel read %r" % (EXPECTED, got))
        print("  " + line)
        return 1
    print("PASS: typed %r and the kernel read it back" % EXPECTED)
    return 0


if __name__ == "__main__":
    sys.exit(main())
