# dotfiles

Managed with [chezmoi](https://chezmoi.io). Currently tracks the zsh shell
setup plus the Homebrew packages it depends on.

## New machine (macOS)

One command installs chezmoi, pulls this repo, installs Homebrew + all
packages, and drops the dotfiles in place:

```sh
sh -c "$(curl -fsSL https://chezmoi.io/get)" -- init --apply <github-user>/dotfiles
```

Replace `<github-user>/dotfiles` with wherever this repo lives once it's
pushed to GitHub.

## What's here

| File                                 | What it is                                  |
| ------------------------------------ | ------------------------------------------- |
| `dot_zshrc`                          | → `~/.zshrc`                                 |
| `Brewfile`                           | packages installed on apply                  |
| `run_once_before_install-packages.sh`| installs Homebrew + runs `brew bundle`       |

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
