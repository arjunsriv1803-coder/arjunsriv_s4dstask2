# Manhattan — Interactive 3D City

A photogrammetry scan of Lower Manhattan, optimised from **519 MB to 11 MB** and
rendered in the browser with React Three Fiber.

**Live:** https://arjun-manhattan-3d.netlify.app

Built for DJS S4DS Tech Task 2. The interesting part of this task is not
rendering a city — it is turning a 519 MB asset into something a browser can
actually load. The full engineering writeup is in
**[OPTIMIZATION.md](OPTIMIZATION.md)**.

---

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

```bash
npm run build     # production build to dist/
npm run preview   # serve the production build locally
npm run lint      # oxlint
```

Requires Node 20 or newer (Vite 8 and React 19).

The optimized models are committed under `public/models/`, so nothing needs
downloading or processing to run the project. The 519 MB source is **not** in the
repository — see [Repository hygiene](#repository-hygiene).

---

## Controls

| Input | Action |
|---|---|
| **Drag** | Orbit |
| **Scroll** | Zoom |
| **W A S D** | Move horizontally |
| **Q / E** | Down / Up |
| **Shift** | 3× speed |
| **R** | Reset to the opening view |

The **Locations** panel flies the camera to six viewpoints, and **Play tour**
walks through all of them automatically. Any input takes back control.

> The brief suggested Space/Shift for vertical movement *and* Shift for the speed
> boost. Those conflict, so vertical is Q/E and Shift is exclusively the boost.

---

## Results

| Metric | Before | After | Change |
|---|---:|---:|---:|
| File size | 519.43 MB | **11.05 MB** | −97.87% |
| Over the wire (compressed) | 25.32 MB | 11.05 MB | −56.4% |
| Triangles | 336,574 | 318,648 | −5.3% |
| GPU texture memory | 122.77 MB | 89.48 MB | −27.1% |
| GPU memory, low tier | 122.77 MB | **22.37 MB** | −81.8% |
| Parse time | 918 ms | 255 ms | −72.2% |
| Load, deployed cold cache | — | **3.25 s** | — |
| Draw calls | — | **17** | — |

Two caveats that belong next to those numbers, both expanded in
[OPTIMIZATION.md](OPTIMIZATION.md):

1. **The source gzips to 25.32 MB**, because ~472 MB of it was duplicated bytes.
   A "97.87% smaller" headline partly measures redundancy any HTTP compression
   would have caught for free.
2. **This did not fix a frame-rate problem.** The unoptimized model still ran at
   117 FPS off a local SSD. The wins are *delivery* and *GPU memory*, not FPS.

### How it got there

Roughly 90% of the reduction came from one lossless command. `gltf-transform
inspect` showed only ~47 MB of *referenced* data inside the 519 MB file — the rest
was buffer data no accessor pointed at:

```bash
gltf-transform dedup manhattan_heavy.glb stage1.glb
# 519.43 MB → 47.57 MB, without touching a pixel or a vertex
```

The remaining stages — weld, simplify, WebP re-encode, meshopt — took it to
11.05 MB. `simplify` deliberately removed only 5.3% of triangles: its 1% error
bound protected the building silhouettes, and the size target was already met.

---

## How it works

```
src/
├── App.jsx                    Canvas config, quality tier, tour sequencing
├── components/
│   ├── CityScene.jsx          Lighting, sky, fog, environment probe
│   ├── CityModel.jsx          Model loading, normalisation, material fixes
│   ├── CameraRig.jsx          Orbit + WASD fly, framing solve, camera flights
│   ├── GradientSky.jsx        Procedural sky dome (shader, no texture)
│   ├── Water.jsx              Ocean with a generated wave normal map
│   ├── Intro.jsx              Title card, loader and tour prompt
│   ├── WaypointNav.jsx        Locations panel
│   ├── ControlsOverlay.jsx    Keyboard legend
│   ├── PostFX.jsx             AO, bloom, vignette, SMAA (high tier only)
│   ├── QualityManager.jsx     Frame-timing monitor → tier
│   ├── PerfSampler.jsx        Reads WebGLRenderer.info (dev only)
│   ├── PerfHUD.jsx            On-screen readout (dev only)
│   └── ReadyProbe.jsx         Fires load metrics on the first real frame
├── hooks/useFlyControls.js    Held-key tracking
└── lib/
    ├── city.js                Model constants, mesh-only bounds
    ├── quality.js             Tier definitions and device detection
    ├── waypoints.js           Measured viewpoint coordinates
    ├── tour.js                Guided tour route
    └── metrics.js             Load instrumentation
```

### Adaptive quality

Three tiers control resolution, the environment probe, fog density and
post-processing. The starting tier is chosen from device signals *before the first
frame* — a frame-timing monitor can only react to frames already rendered, and
without a sensible initial guess a weak device spends its opening seconds
struggling. Touch-primary devices start low and receive the 2048 model.

Post-processing is a **one-way latch**: it can switch off, never back on. Tying it
to the live tier made the effect composer mount and unmount repeatedly, leaking
render targets and collapsing frame times — the fix for adaptive quality was to
make one of its outputs non-adaptive.

### No third-party origins

drei's `Environment preset` fetches an HDR from `raw.githack.com`, and its GLTF
loader attaches a Draco decoder pointing at a Google CDN. Both are disabled. The
sky is a shader, the environment probe is built from lights, and the wave normal
map is generated in code. **Nothing on the critical path leaves the origin.**

### Measured, not guessed

Several values that would normally be eyeballed were derived from the geometry:

- **Camera framing** solves from the model's measured bounding box and the actual
  field of view, so it is correct at any window aspect ratio.
- **Waypoint positions** come from a height-and-density analysis, and each was
  clearance-tested against the mesh — an earlier one sat 1.4 units from a wall,
  inside a building.
- **The waterline** was placed by bucketing triangle area by height.
- **Texture resolution** was chosen from a texel-density table, not by eye.

---

## Repository hygiene

The 519 MB source is gitignored (`*_heavy.glb`) and has never been committed —
GitHub rejects files over 100 MB, and anything committed by accident stays in
history permanently. Verified: no blob in the branch exceeds 50 MB.

Committed assets total 19.46 MB against the 25 MB budget:

| File | Size | Served to |
|---|---:|---|
| `manhattan_4k.glb` | 11.05 MB | High and medium tiers |
| `manhattan_optimized.glb` | 8.42 MB | Low tier |

---

## Deployment

Netlify, from the `arjun_dev` branch. `netlify.toml` pins Node 22 and sets
`Cache-Control: public, max-age=31536000, immutable` on `/models/*` and
`/assets/*` — verified live, so the 11 MB is a first-visit cost only.
`index.html` is deliberately `must-revalidate`: it points at the hashed asset
names, so caching it would pin visitors to a stale build.

---

## Known limitations

- **The asset is a cropped tile of Lower Manhattan.** There is no New Jersey,
  Brooklyn or Upper Manhattan in the file. Beyond the island is open water,
  because there is nothing else to render.
- **Close-range softness is inherent.** One shared atlas across a whole city is
  magnified even at 4096 — measured at ~18× at street level. No resolution
  setting fixes it.
- **Waypoint district names are chosen, not verified.** The coordinates are
  measured; the labels are inferred from the model matching Manhattan's real
  two-cluster pattern. The file identifies nothing.
- **No camera collision.** Nothing stops the camera passing through a wall;
  distance and height clamps make it harder to stumble into.
