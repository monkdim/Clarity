#!/usr/bin/env python3
"""Boot the aarch64 kernel, type at it, and check what it read and what it drew.

A driver that comes up and delivers nothing looks exactly like a driver that
comes up and nobody presses anything — so the boot log's "0 lines" is not a
failure and cannot be one. This makes the keys happen: QEMU's monitor has a
`sendkey` command, so the test can type.

Two things are checked, because there are two ways to be wrong:

  * the lines the kernel says it has, which is what a shell would receive
  * the pixels on the screen, which is what a person would see

Those differ wherever something was corrected. Typing "helxo", backspacing
twice and typing "lo" must leave the kernel holding "hello" *and* the screen
showing "hello" — a console that echoed the backspaces without erasing
anything passes the first and fails the second.

The screen half is checked with fb_check's own model of the console, imported
rather than copied, so there is one description of how a character cell gets
filled in and both tests fail if it stops matching graphics/console.zig.
"""

import os
import socket
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fb_check

READY_MARKER = b"[ok] keyboard: virtio-input"
PROMPT_MARKER = b"type at it"
DONE_MARKER = b"[ok] console input:"

# What to type, as QEMU key names, and what each line should come out as.
#
# The first line is the alphabet twice. Fifty-two key presses, which QEMU
# turns into four events each — press, sync, release, sync — so well over two
# hundred events through a virtqueue of sixty-four. That is deliberate: a
# shorter line fits in the ring the driver hands the device at start-up and
# would pass whether or not buffers are ever given back. Found by typing seven
# keys and reading back six, when the queue was eight deep; "make it bigger"
# is not a diagnosis, so this is the test that tells the two apart.
#
# The second line is the line discipline's own job. Nothing about it is long
# or fast; it is wrong in a specific way and then corrected, and the kernel
# must end up with the correction rather than with what the keys said.
ALPHABET = [chr(c) for c in range(ord("a"), ord("z") + 1)] * 2

KEYS = ALPHABET + ["ret"] + list("helxo") + ["backspace", "backspace"] + \
    list("lo") + ["ret"]
EXPECTED_LINES = ["".join(ALPHABET), "hello"]

# And then the same keyboard, read by a *program*. /bin/clarity-init runs
# twice, in two address spaces, and asks for a line each time — so these are
# typed at its prompt rather than at the kernel's, and they must come back out
# of read(2) rather than out of the line discipline's own report.
#
# Two different words, because two identical ones would not show a second run
# that replayed the first run's input instead of reading its own.
INIT_WORDS = ["alpha", "beta"]
INIT_PROMPT = b"init: type a line: "


def wait_for(log_path, marker, deadline, proc=None):
    """Wait for `marker` to appear in the log, or for the deadline to pass.

    `proc` is watched too: QEMU dying is a different failure from QEMU never
    getting there, and waiting out the deadline on a process that has already
    exited turns a two-second answer into a five-minute one.
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


def wait_for_count(log_path, marker, count, deadline, proc):
    """Wait until `marker` has appeared at least `count` times.

    The init program runs twice and prompts once per run, so "the prompt is
    in the log" is true from the first run onward and says nothing about the
    second. Counting is what tells the two apart.
    """
    while time.time() < deadline:
        try:
            with open(log_path, "rb") as f:
                if f.read().count(marker) >= count:
                    return True
        except FileNotFoundError:
            pass
        if proc.poll() is not None:
            return False
        time.sleep(0.1)
    return False


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


def settled_screendump(mon, out_path):
    """Dump the screen until two dumps in a row are identical.

    Same reason as fb_check's: with `-display none` nothing drives the refresh
    that copies ramfb's guest memory into the surface `screendump` writes out,
    so one dump can be a frame behind. The kernel has stopped reading keys by
    the time this runs, so once two agree the picture has caught up.

    Unlike fb_check's, this goes down the monitor socket already open for
    `sendkey` rather than opening its own: QEMU's Unix monitor takes one
    connection at a time.
    """
    previous = None
    for _ in range(8):
        if os.path.exists(out_path):
            os.unlink(out_path)
        mon.sendall(("screendump %s\n" % out_path).encode())
        for _ in range(40):
            if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                break
            time.sleep(0.25)
        if not os.path.exists(out_path):
            raise SystemExit("key_check: QEMU produced no screenshot")
        with open(out_path, "rb") as f:
            current = f.read()
        if previous is not None and current == previous:
            return current
        previous = current
        time.sleep(1.0)
    raise SystemExit("key_check: the display never settled")


def reported_lines(text):
    out = []
    for line in text.splitlines():
        if line.startswith("  line ") and line.count('"') >= 2:
            out.append(line.split('"')[1])
    return out


def program_lines(text):
    """What /bin/clarity-init says read(2) handed it."""
    out = []
    for line in text.splitlines():
        if line.startswith("  init: read ") and line.count('"') >= 2:
            out.append(line.split('"')[1])
    return out


def check_screen(log_bytes, shot_path):
    """Every character cell on screen against a replay of the serial log.

    Returns (problems, grid) — the grid so the caller can ask what the screen
    says as well as whether it agrees.
    """
    w, h, px = fb_check.read_ppm(shot_path)
    if (w, h) != (fb_check.WIDTH, fb_check.HEIGHT):
        return (["screen is %dx%d, expected %dx%d"
                 % (w, h, fb_check.WIDTH, fb_check.HEIGHT)], None)
    replayed = fb_check.expected_screen(log_bytes)
    if replayed is None:
        return (["the kernel never turned on the screen console"], None)
    grid, _ = replayed
    font = fb_check.load_font()
    problems = []
    for row in range(fb_check.ROWS):
        for col in range(fb_check.COLS):
            ch = chr(grid[row][col])
            glyph = font.get(ch) or font["?"]
            bad = fb_check.compare_cell(px, w, col, row, glyph)
            if bad:
                problems.append("cell (%d,%d) should be %r: %s"
                                % (col, row, ch, bad))
                if len(problems) >= 5:
                    return (problems, grid)
    return (problems, grid)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: key_check.py <kernel-image>")
    kernel = sys.argv[1]
    tmp = tempfile.mkdtemp(prefix="claritykey-")
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
        "-device", "virtio-keyboard-device",
        "-serial", "file:" + log,
        "-display", "none",
        "-monitor", "unix:%s,server,nowait" % sock,
        "-no-reboot",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)

    try:
        # Two deadlines, because there are two waits and only one of them is
        # about this test. Getting as far as the keyboard is most of a boot,
        # and under TCG on a shared runner that is minutes; what happens after
        # the keys are sent is seconds. One deadline covering both would have
        # to be generous enough for the boot, leaving the part being measured
        # with no bound worth having.
        deadline = time.time() + 300
        # Connect before the kernel is ready, so no time is lost afterwards:
        # the kernel stops reading a few seconds after it starts, and that
        # window is what the keys have to arrive in.
        m = monitor(sock, deadline)
        if not wait_for(log, PROMPT_MARKER, deadline, qemu):
            try:
                with open(log, "rb") as f:
                    tail = f.read()[-1200:].decode("utf-8", "replace")
            except FileNotFoundError:
                tail = "(no serial log at all)"
            if qemu.poll() is not None:
                print("FAIL: QEMU exited (%d) before the kernel asked for input"
                      % qemu.returncode)
            else:
                print("FAIL: the kernel never asked for input")
            print(tail)
            return 1

        for k in KEYS:
            m.sendall(("sendkey %s\n" % k).encode())
            time.sleep(0.05)

        if not wait_for(log, DONE_MARKER, time.time() + 60, qemu):
            print("FAIL: the kernel never reported what it read")
            return 1

        # Now the same keyboard, read by a program. /bin/clarity-init asks for
        # a line on each of its two runs; each prompt has to be waited for
        # separately, because the kernel's read gives up a few seconds after
        # the prompt appears and typing early would be typing into nothing.
        for i, word in enumerate(INIT_WORDS):
            if not wait_for_count(log, INIT_PROMPT, i + 1, time.time() + 120,
                                  qemu):
                print("FAIL: the init program never asked for line %d" % (i + 1))
                return 1
            for k in list(word) + ["ret"]:
                m.sendall(("sendkey %s\n" % k).encode())
                time.sleep(0.05)

        # Let the boot finish before looking at the screen.
        #
        # The first version screenshotted here, straight after the input
        # section, and compared it against the log truncated at that point.
        # It failed, and not because anything was wrong: the display settles
        # over a second or two, the kernel keeps printing for several, and by
        # the time two dumps agree the boot is over and the screen is thirty
        # lines further on. Waiting for the halt is what makes the picture and
        # the log describe the same moment. The typed lines are still on
        # screen when it does, and the check below fails loudly if they ever
        # stop being.
        if not wait_for(log, fb_check.BOOT_MARKER, time.time() + 300, qemu):
            print("FAIL: the kernel read the input but never finished booting")
            return 1

        shot_bytes = settled_screendump(m, shot)
        with open(log, "rb") as f:
            log_bytes = f.read()
    finally:
        qemu.terminate()
        try:
            qemu.wait(timeout=10)
        except subprocess.TimeoutExpired:
            qemu.kill()

    text = log_bytes.decode("utf-8", "replace")
    got = reported_lines(text)
    if got != EXPECTED_LINES:
        print("FAIL: typed %r, the kernel read %r" % (EXPECTED_LINES, got))
        for candidate in text.splitlines():
            if candidate.startswith("  line ") or DONE_MARKER.decode() in candidate:
                print("  " + candidate)
        return 1

    # What the program got out of read(2), which is a different path from the
    # one above: through a system call, into a buffer in its own address
    # space, translated for writing through its own page tables.
    from_program = program_lines(text)
    if from_program != INIT_WORDS:
        print("FAIL: typed %r at the program, read(2) gave it %r"
              % (INIT_WORDS, from_program))
        for candidate in text.splitlines():
            if "init: read" in candidate or "user read" in candidate:
                print("  " + candidate)
        return 1

    # And that the refusal happened. Without this the two lines above would
    # pass just as well on a kernel that never checked the buffer at all —
    # the bad pointer is the program's first read, and if it were accepted
    # the line would be delivered into read-only text and never reach the
    # buffer that gets printed.
    refusals = text.count("[ok] user read: a bad buffer was refused")
    if refusals != len(INIT_WORDS):
        print("FAIL: expected %d refused reads, saw %d — the kernel is not "
              "checking that a read buffer is writable"
              % (len(INIT_WORDS), refusals))
        return 1

    problems, grid = check_screen(log_bytes, shot)
    if problems:
        print("FAIL: the screen does not show what the kernel said")
        for p in problems:
            print("  " + p)
        return 1

    # Every cell matching the replay says the screen agrees with the log. It
    # does not say the corrected line is on it: a screen that had scrolled the
    # typing away would agree just as well, and this test would then be
    # checking the boot messages that replaced it.
    #
    # So find the line, on the screen, by what it must say. The prompt and the
    # correction together: "hello" appears nowhere else in a boot log, and
    # after "  > " it can only have got there by five keys, two backspaces and
    # two more keys coming out right.
    wanted = "  > " + EXPECTED_LINES[1]
    rows = ["".join(chr(c) for c in row) for row in grid]
    if not any(r.startswith(wanted) for r in rows):
        # Deliberately does not name a cause. Two produce this: the typing
        # scrolled off before the picture was taken, and the editor never
        # echoed anything — the second was measured by removing the echo, and
        # it looks identical from here, because a screen showing nothing
        # agrees perfectly with a log containing nothing.
        print("FAIL: the screen agrees with the log, but %r is not on it — "
              "either nothing was echoed, or it scrolled away before the "
              "picture was taken" % wanted)
        return 1

    print("PASS: the kernel read %r, read(2) gave the program %r "
          "(after refusing a read-only buffer both times), and the screen "
          "shows %r on a row of its own" % (got, from_program, wanted))
    print("      (%d bytes of screenshot, every character cell checked)"
          % len(shot_bytes))
    return 0


if __name__ == "__main__":
    sys.exit(main())
