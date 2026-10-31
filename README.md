# dotfiles

Managed with [chezmoi](https://chezmoi.io). Currently tracks the zsh shell
setup plus the Homebrew packages it depends on.

## New machine (macOS or Debian/Ubuntu)

One command installs chezmoi, pulls this repo, installs Homebrew + all
packages, and drops the dotfiles in place:

```sh
sh -c "$(curl -fsSL https://chezmoi.io/get)" -- init --apply git@github.com:guylyons/guy-chezmoi.git
```

Before running it, add this machine's SSH key to GitHub. The repo and the
nvim/emacs configs are cloned over SSH.

### Linux extras

On Debian, first install the basics: `sudo apt install curl git`. The install
script then installs Homebrew's prerequisites and zsh (it asks for your sudo
password once). After that:

- Make zsh your shell: `chsh -s "$(command -v zsh)"`, then log out and back in.
- The Brewfile's casks (GUI apps) are macOS-only. On Linux install them
  separately: `sudo apt install emacs`, plus Ghostty, VS Code and DBeaver from
  their own sites. For ddev, install Docker Engine (https://docs.docker.com/engine/install/debian/).
- Karabiner config is skipped on Linux.

`.github/workflows/linux.yml` applies everything on a fresh Debian 13 machine
on each push, so Linux breakage shows up as a failed GitHub Actions run.

## What's here

| File                                 | What it is                                  |
| ------------------------------------ | ------------------------------------------- |
| `dot_zshrc`                          | → `~/.zshrc`                                 |
| `Brewfile`                           | packages installed on apply                  |
| `run_onchange_before_install-packages.sh.tmpl` | installs Homebrew + runs `brew bundle` |

## Everyday use

```sh
chezmoi add ~/.somefile   # start tracking a file
chezmoi edit ~/.zshrc     # edit the source, then `chezmoi apply`
chezmoi diff              # preview what apply would change
chezmoi apply             # write changes into $HOME
chezmoi cd                # drop into the source repo (git lives here)
```

Add a package by editing `Brewfile`, then `chezmoi apply` (the install
script re-runs whenever its contents or the Brewfile change).
