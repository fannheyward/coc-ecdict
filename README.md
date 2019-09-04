# coc-ecdict

ECDICT extension for coc.nvim. Inspired by [edict.ts](https://github.com/iamcco/dotfiles/blob/master/nvim/coc-extensions-source/src/edict.ts), and thanks for [ECDICT](https://github.com/skywind3000/ECDICT).

## Install

`:CocInstall coc-ecdict`

## Usage

```vim
nnoremap <silent> K :call CocActionAsync('doHover')<CR>
```

Lookup the keyword under cursor with `K`, and shows translation in preview/floating window if found.

## License

MIT

---
> This extension is created by [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
