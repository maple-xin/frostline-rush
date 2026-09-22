# Frostline Rush 3D

An original, offline, portrait WebGL downhill arcade game. The game uses original procedural 3D models and locally bundled Three.js. All in-game text is English.

## Play

Open `index.html` directly in Chrome, Edge, Safari, or another modern WebGL browser. No network or build process is needed. `bundle.js` is included so direct `file://` access works.

On phones, drag on the slope to steer, hold **BOOST**, tap **JUMP**, and swipe while airborne to spin. On desktop, use Left/Right or A/D to steer, Space to jump, Shift to boost, Q/E to spin, and Escape to pause.

Collect stars, dodge rocks, jump off ramps, and reach the finish at 2,400 meters.

## Files and license

`index.html`, `style.css`, and `bundle.js` are sufficient to run the game. `game.js`, `build-bundle.cjs`, and `vendor/` preserve editable source and the local Three.js modules. Rebuild with `node build-bundle.cjs` after editing `game.js`.

Three.js is copyright 2010–2025 Three.js Authors and is used under the MIT License. See `THREE-LICENSE.txt`.
