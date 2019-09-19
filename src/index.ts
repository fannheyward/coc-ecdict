import { ExtensionContext, languages, workspace } from 'coc.nvim';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import got from 'got';
import { join } from 'path';
import readline from 'readline';
import { Hover, MarkupKind } from 'vscode-languageserver-protocol';

const ecdictName = 'ecdict.csv';
const ecdictUrl = 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv';

const ecdictData = new Map();

export async function download(path: string, url: string, name: string): Promise<void> {
  let statusItem = workspace.createStatusBarItem(0, { progress: true });
  statusItem.text = `Downloading ${name} data...`;
  statusItem.show();

  return new Promise((resolve, reject) => {
    try {
      got
        .stream(url)
        .on('downloadProgress', progress => {
          let p = (progress.percent * 100).toFixed(0);
          statusItem.text = `${p}% Downloading ${name} data...`;
        })
        .on('end', () => {
          statusItem.hide();
          resolve();
        })
        .on('error', e => {
          reject(e);
        })
        .pipe(createWriteStream(path));
    } catch (e) {
      reject(e);
    }
  });
}

function getWordByIndex(word: string, idx: number) {
  while (/[-_]/.test(word[idx])) {
    idx += 1;
  }
  if (idx == word.length) {
    idx -= 1;
    while (/[-_]/.test(word[idx])) {
      idx -= 1;
    }
  }
  if (idx < 0) {
    return '';
  }
  let start = idx;
  let end = idx + 1;
  while (start > 0) {
    if (/[A-Z]/.test(word[start])) {
      break;
    } else if (/[-_]/.test(word[start])) {
      start += 1;
      break;
    }
    start -= 1;
  }
  while (end < word.length) {
    if (/[A-Z_-]/.test(word[end])) {
      end -= 1;
      break;
    }
    end += 1;
  }
  return word.slice(start, end + 1);
}

function formatDoc(word: string, words: Record<string, string>) {
  let values = [`**${word}**`];
  if (words.phonetic) {
    values = values.concat(['', `**音标：**${words.phonetic}`]);
  }
  if (words.definition) {
    values = values.concat(['', '**英文解释：**', '', ...words.definition.split('\\n').map((line: string) => line.replace(/^"/, ''))]);
  }
  if (words.translation) {
    values = values.concat(['', '**中文解释：**', '', ...words.translation.split('\\n').map((line: string) => line.replace(/^"/, ''))]);
  }
  if (words.pos) {
    values = values.concat(['', `**词语位置：**${words.pos.replace(/\n/g, ' ')}`]);
  }
  return values;
}

async function ecdictInit(ecdictPath: string): Promise<void> {
  return new Promise(resolve => {
    readline
      .createInterface(createReadStream(ecdictPath), undefined, undefined, false)
      .on('line', (line: string) => {
        const items = line.split(',');
        if (items.length < 5) {
          return;
        }
        ecdictData.set(items[0].toLowerCase(), {
          phonetic: items[1] || '',
          definition: items[2] || '',
          translation: items[3] || '',
          pos: items[4] || ''
        });
      })
      .on('close', () => {
        resolve();
      });
  });
}

export async function activate(context: ExtensionContext): Promise<void> {
  if (!existsSync(context.storagePath)) {
    mkdirSync(context.storagePath);
  }
  const ecdictPath = join(context.storagePath, ecdictName);
  if (!existsSync(ecdictPath)) {
    await download(ecdictPath, ecdictUrl, 'ECDICT');
    await ecdictInit(ecdictPath);
  } else {
    await ecdictInit(ecdictPath);
  }

  context.subscriptions.push(
    languages.registerHoverProvider(['*'], {
      provideHover(document, position): Hover | null {
        const doc = workspace.getDocument(document.uri);
        if (!doc) {
          return null;
        }
        const wordRange = doc.getWordRangeAtPosition(position);
        if (!wordRange) {
          return null;
        }
        const wordText = document.getText(wordRange);
        let word = wordText;
        if (!word) {
          return null;
        }
        let words = ecdictData.get(word.toLowerCase());
        if (!words) {
          word = wordText.replace(/((\B[A-Z])|-+|_+)/g, ' $2');
          words = ecdictData.get(word.toLowerCase());
        }
        if (!words) {
          word = getWordByIndex(wordText, position.character - wordRange.start.character);
          words = ecdictData.get(word.toLowerCase());
        }
        if (!words) {
          return null;
        }
        const values = formatDoc(word, words);
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: values.join('\n')
          }
        };
      }
    })
  );
}
