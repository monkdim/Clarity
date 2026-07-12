// Browser entry point for KyanOS. Bundled to ../kyanos.bundle.js.
import { kyan_desktop } from './kyan_desktop.js';
import { kyan_obsidian } from './theme_kyan.js';
import { MouseEvent } from './mouse.js';

// Create a desktop of the given pixel size and boot it.
export function createDesktop(w, h) {
  const desk = kyan_desktop(w, h, kyan_obsidian());
  desk.boot(null);
  return desk;
}

// Compose a frame and return the raw framebuffer bytes plus geometry.
// The returned Uint8Array is BGRA (byte order B,G,R,A) — convert before
// presenting to a canvas ImageData (which wants R,G,B,A).
export function composeToBytes(desk) {
  const fb = desk.compose();
  // fb.buffer is a Clarity Pointer whose runtime handle ({_buffer,size})
  // holds the Uint8Array backing store.
  return {
    bytes: fb.buffer._handle._buffer,   // Uint8Array of length width*height*4
    width: fb.width,
    height: fb.height,
  };
}

// Build a MouseEvent from raw fields and dispatch it into the desktop.
export function sendMouse(desk, x, y, kind, button = 0) {
  const me = new MouseEvent();
  me.x = x | 0;
  me.y = y | 0;
  me.button = button | 0;
  me.is_press = kind === 'press';
  me.is_release = kind === 'release';
  me.is_motion = kind === 'motion';
  desk.handle_mouse(me);
  return me;
}

export function openApp(desk, appId, x, y, w, h) {
  return desk.open(appId, x, y, w, h);
}

export function toggleLauncher(desk) {
  return desk.toggle_launcher();
}

// Live launcher search: while the launcher is open it owns typed input.
export function launcherType(desk, text) {
  return desk.launcher_type(text);
}
export function launcherBackspace(desk) {
  return desk.launcher_backspace();
}
export function launcherSubmit(desk) {
  return desk.launcher_submit();
}

// Feed key state (browser e.key) so live apps (Voidrunner) can read it.
export function setKey(desk, name, down) {
  desk.set_key(name, !!down);
}

// Advance time-based apps one frame; call before composeToBytes each rAF.
export function tick(desk, nowMs) {
  desk.tick(nowMs);
}

// Whether the desktop changed since the last compose. The host loop uses
// this to skip recompositing an idle frame — frosted glass is costly, so
// an unchanging desktop should cost nothing. A running game reports dirty
// every frame, so animation stays smooth.
export function needsRedraw(desk) {
  return desk.needs_redraw();
}

export { MouseEvent };

// Browser global for a single-file (inlined) build.
globalThis.KyanOS = { createDesktop, composeToBytes, sendMouse, openApp, toggleLauncher, launcherType, launcherBackspace, launcherSubmit, setKey, tick, needsRedraw, MouseEvent };
