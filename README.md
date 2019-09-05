# coc-ecdict

ECDICT extension for coc.nvim. Inspired by [edict.ts](https://github.com/iamcco/dotfiles/commit/0885d76a9b1fff98ad19ab5f1892cdd910bbba99#diff-cbb8dd59854b560f9ecafdfad5d3cc4d), and thanks for [ECDICT](https://github.com/skywind3000/ECDICT).

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
