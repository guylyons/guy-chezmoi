# Brewfile — packages chezmoi installs on `chezmoi apply`.
# Edit this list, then run `chezmoi apply` (or `brew bundle`) to sync.

# --- always want these ---
brew "fzf"        # fuzzy finder
brew "ripgrep"    # fast grep (rg); also used by .vimrc grepprg
brew "fd"         # fast find alternative (used by yazi)
brew "starship"   # shell prompt
brew "bun"        # JS runtime / package manager
brew "pnpm"       # fast, disk-efficient JS package manager
brew "zoxide"     # smarter cd
brew "yazi"       # terminal file manager (uses fd/rg/fzf/zoxide, already above)
brew "jj"         # jujutsu: git-compatible version control
brew "jq"         # command-line JSON processor

# --- required by .zshrc so the shell starts clean ---
brew "fnm"                     # node version manager (eval on startup)
brew "fzf-tab"                 # fzf-based completion menu
brew "zsh-autosuggestions"     # sourced by .zshrc
brew "zsh-syntax-highlighting" # sourced by .zshrc
brew "zsh-completions"         # extra completion defs (fpath)

# --- editor + terminal ---
brew "neovim"       # aliased `v=nvim` in .zshrc
cask "ghostty"      # terminal emulator (config tracked in dot_config/ghostty)

# --- local dev: ddev + Docker provider ---
tap "ddev/ddev"
brew "ddev"        # Drupal/PHP local dev (aliases cim/cex/cr in .zshrc)
cask "orbstack"    # Docker provider for ddev (lightweight Docker Desktop alt)
