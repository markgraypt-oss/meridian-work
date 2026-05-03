#!/usr/bin/env python3
"""Drive drizzle-kit push interactively, accepting the default option for every prompt.

Drizzle-kit prompts via the `prompts` npm package which requires a TTY. We
allocate one with pty.fork(), then mirror child output to our stdout while
auto-pressing Enter whenever the child appears to be waiting for input. The
default highlighted option is always the safe one (e.g. "No, add the constraint
without truncating").
"""
import os, pty, select, sys, time, re

CMD = ["npm", "run", "db:push"]
ANSI = re.compile(rb"\x1b\[[0-9;?]*[A-Za-z]")

pid, fd = pty.fork()
if pid == 0:
    os.execvp(CMD[0], CMD)

last_data_at = time.time()
buf = b""
sent_for_prompt = False
exit_code = 0

# Drizzle-kit prompts always render a "❯ " selector arrow on a line that follows
# a "·"-prefixed question. Restrict auto-Enter to those signatures.
PROMPT_MARKERS = (b"\xe2\x9d\xaf ", b"(y/N)", b"(Y/n)")

while True:
    r, _, _ = select.select([fd], [], [], 0.5)
    now = time.time()
    if r:
        try:
            data = os.read(fd, 4096)
        except OSError:
            break
        if not data:
            break
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
        buf += data
        last_data_at = now
        # Detect a prompt: "❯" (selector arrow) or "(Y/n)" patterns
        clean = ANSI.sub(b"", buf[-2048:])
        if any(m in clean for m in PROMPT_MARKERS):
            sent_for_prompt = True
        else:
            sent_for_prompt = False
    else:
        # Idle. If a prompt is waiting and stable, press Enter.
        if sent_for_prompt and (now - last_data_at) > 1.0:
            os.write(fd, b"\r")
            sent_for_prompt = False
            last_data_at = now
            buf = b""
        # Overall idle timeout
        if (now - last_data_at) > 60:
            print("\n[drizzle-push.py] Idle timeout, killing child", file=sys.stderr)
            try:
                os.kill(pid, 9)
            except ProcessLookupError:
                pass
            exit_code = 124
            break

try:
    _, status = os.waitpid(pid, 0)
    if exit_code == 0:
        exit_code = os.waitstatus_to_exitcode(status)
except ChildProcessError:
    pass

sys.exit(exit_code)
