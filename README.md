# popo-lamp

A small portfolio landing page: a toon-shaded desk lamp sitting on a planet, following the cursor across a hand-drawn menu.

![demo](demo.gif)

**Live:** https://popo-lamp.wispbyte.app

## What it does

- The menu is set in a serif face with roman-numeral badges; hovering an item paints a rough white blob behind it.
- The lamp head always aims at the item under the cursor, so the light lands exactly on it.
- The arm is a real two-jointed chain driven by two-bone IK: the lower stem swings out and folds, the elbow bends, the head turns. The body picks a new lean and reach at random every couple of seconds, with different spring stiffness each time, so the pose never settles into a loop that follows the list.
- The beam is an evenly lit, feathered cone drawn on a camera-facing card, with a few dust motes drifting through it.
- Responsive: the composition and the arm's travel are re-tuned for portrait screens.

## Run it

```bash
node index.js          # http://localhost:5178
```

There is no build step. three.js r186 is loaded from a CDN through an import map.

## Files

| file | what it holds |
| --- | --- |
| `index.html` | markup, menu, and the SVG blob filter |
| `scene.js` | scene, lamp rig, IK, beam, dust |
| `style.css` | layout, typography, hover states, grain |
| `index.js` | small static file server |

## Hosting

Deployed on a free Wispbyte Node.js instance. `index.js` listens on `PORT` or `SERVER_PORT`, so it works behind the panel's allocation without changes.
