import { ExtensionContext, Hover, languages, window, workspace } from 'coc.nvim';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import fetch from 'node-fetch';
import { join } from 'path';
import readline from 'readline';
import stream from 'stream';
import util from 'util';
const pipeline = util.promisify(stream.pipeline);

const ecdictName = 'ecdict.csv';
const ecdictUrl = 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv';

const ecdictData = new Map();

async function download(dest: string, url: string, name: string): Promise<void> {
  const statusItem = window.createStatusBarItem(0, { progress: true });
  statusItem.text = `Downloading ${name}...`;
  statusItem.show();

  const resp = await fetch(url);
  if (!resp.ok) {
    statusItem.hide();
    throw new Error('Download failed');
  }

  const destFileStream = createWriteStream(dest);
  await pipeline(resp.body, destFileStream);
  await new Promise<void>((resolve) => {
    destFileStream.on('close', resolve);
    destFileStream.destroy();
    setTimeout(resolve, 1000);
  });

  statusItem.hide();
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
  let values = [`_${word}_`];
  if (words.phonetic) {
    values = values.concat(['', `__音标：__${words.phonetic}`]);
  }
  if (words.definition) {
    values = values.concat(['', '__英文解释：__', '', ...words.definition.split('\\n').map((line: string) => line.replace(/^"/, ''))]);
  }
  if (words.translation) {
    values = values.concat(['', '__中文解释：__', '', ...words.translation.split('\\n').map((line: string) => line.replace(/^"/, ''))]);
  }
  if (words.pos) {
    values = values.concat(['', `__词语位置：__${words.pos.replace(/\n/g, ' ')}`]);
  }
  return values;
}

async function ecdictInit(ecdictPath: string): Promise<void> {
  return new Promise((resolve) => {
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
          pos: items[4] || '',
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
  }

  context.subscriptions.push(
    languages.registerHoverProvider(['*'], {
      async provideHover(document, position): Promise<Hover | null> {
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
        if (!ecdictData.size) {
          await ecdictInit(ecdictPath);
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
            kind: 'markdown',
            value: values.join('\n'),
          },
        };
      },
    })
  );
}
