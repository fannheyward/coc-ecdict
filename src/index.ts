import { ExtensionContext, languages, workspace } from 'coc.nvim';
import { getAgent } from 'coc.nvim/lib/model/fetch';
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

  const agent = getAgent('https');
  return new Promise((resolve, reject) => {
    try {
      got
        .stream(url, { agent })
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

async function ecdictInit(ecdictPath: string): Promise<void> {
  return new Promise(resolve => {
    readline
      .createInterface(createReadStream(ecdictPath), undefined, undefined, false)
      .on('line', (line: string) => {
        line.split('\n').forEach((line: string) => {
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
        const word = (document.getText(wordRange) || '').toLowerCase();
        if (!word || !ecdictData.has(word)) {
          return null;
        }
        const words = ecdictData.get(word);
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
          values = values.concat(['', `**词语位置：**${words.pos.replace(/\n/, ' ')}`]);
        }
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
