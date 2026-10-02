/**
 * vite build 결과(dist/)의 JS·CSS를 index.html 안에 넣어 파일 하나짜리 게임을 만든다.
 *   npm run build:single  →  dist/fx-arena.html
 * 브라우저는 file:// 로 연 페이지에서 외부 모듈 스크립트(<script type="module" src>)를 막기 때문에,
 * 내려받아 더블클릭으로 실행하려면 스크립트를 인라인으로 넣어야 한다.
 */
import { transformSync } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

const scriptRe = /<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/;
const styleRe = /<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/;
const script = html.match(scriptRe);
const style = html.match(styleRe);
if (!script || !style) throw new Error('dist/index.html에서 번들 스크립트/스타일 태그를 찾지 못했습니다.');

// 한 줄로 이어진 번들을 짧은 줄로 다시 나눈다(의미는 그대로, 파일을 열어 보거나 옮길 때 다루기 쉬움).
const bundled = readFileSync(join(dist, script[1]), 'utf8');
const wrapped = transformSync(bundled, { minify: true, lineLimit: 120, format: 'esm', charset: 'utf8', legalComments: 'none' }).code;
// 인라인 <script>/<style> 안에서 HTML 파서가 태그를 일찍 끝내지 않도록 이스케이프한다.
const js = wrapped.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const css = readFileSync(join(dist, style[1]), 'utf8')
  .replace(/<\/(style)/gi, '<\\/$1')
  .replace(/}/g, '}\n');

// 모듈 스크립트는 DOM 파싱 뒤에 실행되도록 body 끝으로 옮긴다(인라인 모듈도 defer처럼 동작하지만 위치를 명확히 함).
html = html.replace(new RegExp(`[ \\t]*${scriptRe.source}\\n?`), '');
html = html.replace(styleRe, () => `<style>\n${css}</style>`);
html = html.replace('</body>', () => `<script type="module">\n${js}</script>\n</body>`);

const out = join(dist, 'fx-arena.html');
writeFileSync(out, html);
console.log(`단일 파일 빌드: ${out} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
