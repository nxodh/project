import './style.css';
import './weapons/functions';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { View } from './core/view';
import { installDebugApi } from './debug';
import { Game } from './game/game';
import { Renderer } from './render/renderer';
import { Overlays } from './ui/overlays';
import { getWeapons } from './weapons/registry';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = new View(canvas);
const input = new Input(canvas);
const renderer = new Renderer(canvas, view);
const overlays = new Overlays(getWeapons());
const game = new Game(view, input, renderer, overlays);

if (new URLSearchParams(location.search).has('debug')) installDebugApi(game, view, input);

startLoop((dt) => game.frame(dt));
