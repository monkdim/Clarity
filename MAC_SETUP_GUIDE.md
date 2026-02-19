# Setting Up Clarity on macOS — Step by Step

A complete beginner's guide to installing Clarity and creating the Clarity Terminal on your Mac.

---

## What You'll End Up With

- The `clarity` command available anywhere in Terminal
- The `clarity-terminal` command that launches a branded Clarity session
- A **Clarity Terminal** profile you can double-click to open a dedicated window

---

## Prerequisites

You need a Mac running macOS 10.15 (Catalina) or newer. That's it — the setup script handles the rest.

---

## Step 1: Open Terminal

Terminal is the built-in command-line app on every Mac.

1. Press **Cmd + Space** to open Spotlight
2. Type **Terminal**
3. Press **Enter**

A window with a text prompt appears. This is where you'll type all the commands below.

> **Tip:** You can also find Terminal in **Applications > Utilities > Terminal**.

---

## Step 2: Install Git (if you don't have it)

Check if Git is already installed:

```bash
git --version
```

If you see a version number like `git version 2.39.0`, you're good — skip to Step 3.

If you see a dialog asking to install developer tools, click **Install** and wait for it to finish. Then run the command again to confirm.

---

## Step 3: Clone the Clarity Repository

This downloads all the Clarity source code to your Mac.

```bash
cd ~
git clone https://github.com/monkdim/Clarity.git
cd Clarity
```

**What this does:**
- `cd ~` moves to your home folder (e.g., `/Users/yourname/`)
- `git clone ...` downloads the Clarity repository
- `cd Clarity` moves into the downloaded folder

---

## Step 4: Run the Setup Script

The setup script checks for prerequisites, installs anything missing, builds Clarity from source, and installs it.

```bash
bash setup-mac.sh
```

**What happens during setup:**

1. **Xcode CLI Tools** — Checks if they're installed (needed for compiling). If not, a dialog pops up — click Install.
2. **Python 3** — Checks if Python 3 is available (macOS usually includes it).
3. **Bun** — Checks for the Bun JavaScript runtime. If missing, it installs it automatically.
4. **Build** — Compiles Clarity source code into a native binary for your Mac.
5. **Install** — Copies the `clarity` binary to `/usr/local/bin/` so you can use it from anywhere.

> **Note:** You may be asked for your Mac password (for `sudo`). This is normal — it's needed to copy files into `/usr/local/bin/`.

---

## Step 5: Verify the Installation

After setup completes, test that Clarity works:

```bash
clarity version
```

You should see something like:

```
clarity 1.0.0
```

Try running the hello world example:

```bash
clarity run ~/Clarity/examples/hello.clarity
```

---

## Step 6: Launch the Clarity Terminal

The Clarity Terminal is an interactive environment where you can type Clarity code and see results instantly.

### Option A: Use the command

```bash
clarity-terminal
```

This shows a branded welcome screen and drops you into the Clarity interactive shell.

### Option B: Use `clarity shell` directly

```bash
clarity shell
```

Same interactive shell, just without the welcome banner.

### Option C: Install the Terminal.app profile (optional)

This creates a dedicated "Clarity" profile in macOS Terminal.app:

```bash
open ~/Clarity/Clarity.terminal
```

macOS will ask if you want to install the profile. Click **Keep**. Now:

1. Open **Terminal > Settings** (or press **Cmd + ,**)
2. Click the **Profiles** tab
3. You'll see a profile called **Clarity** — select it
4. Click **Default** at the bottom to make it your default, or just double-click the `Clarity.terminal` file anytime to open a Clarity session

---

## Using the Clarity Terminal

Once you're in the Clarity Terminal, you can do two things:

### 1. Write Clarity code

```
clarity> show "Hello from Clarity!"
Hello from Clarity!

clarity> let nums = [1, 2, 3, 4, 5]
clarity> nums |> map(x => x * x) |> show
[1, 4, 9, 16, 25]

clarity> fn greet(name) { show "Hey {name}!" }
clarity> greet("World")
Hey World!
```

### 2. Run shell commands

The Clarity shell also understands regular terminal commands:

```
clarity> ls
README.md  examples/  stdlib/  ...

clarity> pwd
/Users/yourname/Clarity

clarity> echo "mixing shell and Clarity!"
mixing shell and Clarity!
```

### REPL commands

| Command  | What it does                        |
|----------|-------------------------------------|
| `.help`  | Show available commands              |
| `.clear` | Clear the screen                     |
| `.reset` | Start fresh (forget all variables)   |
| `.env`   | Show all your current variables      |
| `.exit`  | Leave the Clarity Terminal           |

You can also press **Ctrl + C** to exit at any time.

---

## Running Clarity Programs

### Create a file

Open any text editor and create a file called `myprogram.clarity`:

```
-- myprogram.clarity
let name = ask("What's your name? ")
show "Hello, {name}!"

let nums = [1, 2, 3, 4, 5]
let total = nums |> reduce((a, b) => a + b, 0)
show "The sum of {nums} is {total}"
```

### Run it

```bash
clarity run myprogram.clarity
```

### Run with the faster bytecode VM

```bash
clarity run myprogram.clarity --fast
```

---

## Optional: Add Clarity to Your Shell Startup

To make the `clarity` command available in every new terminal window (usually already done by the installer):

### If you use Zsh (default on modern macOS):

```bash
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### If you use Bash:

```bash
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
```

---

## Optional: Create a Desktop Shortcut

You can create an app-like shortcut that opens Clarity Terminal with a double-click:

1. Open **Automator** (search for it in Spotlight)
2. Choose **Application**
3. Search for **Run Shell Script** in the actions panel
4. Drag it to the workflow area
5. Paste this command:
   ```bash
   /usr/local/bin/clarity-terminal
   ```
6. Set "Shell" to `/bin/bash`
7. Go to **File > Save**, name it **Clarity Terminal**, save to Desktop or Applications
8. To change the icon: right-click the app > Get Info > drag a `.icns` file onto the icon in the top-left

---

## Uninstalling

To remove Clarity from your system:

```bash
sudo rm /usr/local/bin/clarity
sudo rm /usr/local/bin/clarity-terminal
rm -rf ~/Clarity
```

To remove the Terminal.app profile, go to **Terminal > Settings > Profiles**, select "Clarity", and click the minus (-) button.

---

## Troubleshooting

### "command not found: clarity"

Your PATH doesn't include `/usr/local/bin`. Add it:

```bash
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### "Permission denied" during setup

The script needs sudo access to install to `/usr/local/bin`. Enter your Mac password when prompted. You won't see the characters as you type — that's normal.

### Build fails with "bun: command not found"

Close Terminal and re-open it (so the shell picks up the new Bun install), then re-run:

```bash
cd ~/Clarity
bash setup-mac.sh
```

### Build fails with Python errors

Make sure you have Python 3.8 or newer:

```bash
python3 --version
```

If the version is too old, install the latest from https://python.org.

### "Xcode CLI tools" dialog won't go away

Run this in Terminal:

```bash
sudo xcode-select --reset
xcode-select --install
```

---

## Quick Command Reference

| Command | What it does |
|---------|-------------|
| `clarity-terminal` | Launch the Clarity Terminal |
| `clarity shell` | Interactive shell (Clarity + system commands) |
| `clarity repl` | Basic REPL (Clarity only) |
| `clarity run file.clarity` | Run a program |
| `clarity run file.clarity --fast` | Run with bytecode VM (faster) |
| `clarity check file.clarity` | Check syntax without running |
| `clarity lint file.clarity` | Check for common issues |
| `clarity fmt file.clarity --write` | Auto-format your code |
| `clarity test` | Run test files |
| `clarity help` | Show all commands |
| `clarity version` | Show installed version |

---

## Next Steps

- Read the [Beginner's Guide](BEGINNERS_GUIDE.md) to learn the Clarity language
- Explore the `examples/` folder for sample programs
- Try `clarity debug myprogram.clarity` for step-through debugging
- Check out `clarity doc stdlib/` to browse the standard library docs
