# Optimization writeup

**Source:** `manhattan_heavy.glb` — 519,434,492 bytes (519.43 MB)
**Shipped:** `manhattan_4k.glb` — 11,045,848 bytes (11.05 MB)
**Reduction:** 97.87%
**Live:** https://arjun-manhattan-3d.netlify.app

Every number in this document was measured. Where a figure is a calculation
rather than a measurement, it says so. Where a decision has a cost, the cost is
stated rather than omitted.

---

## 1. The finding that mattered most: measure before you optimize

The brief predicted three likely causes for a 519 MB model: 4K/8K textures stored
as uncompressed PNG, uncompressed float32 vertex attributes, or duplicated meshes
that were never instanced.

`gltf-transform inspect` said otherwise:

| Property | Value |
|---|---|
| Meshes | 15 (`Object_0` … `Object_14`) |
| Materials | 1 (`BuildingMat-00360`) |
| Textures | 1 — 4096×4096 **JPEG**, 14.27 MB |
| Triangles | 336,574 |
| Generator | Sketchfab 12.67.0 |

Add it up: roughly 33 MB of geometry plus 14.27 MB of texture. **About 47 MB of
referenced data inside a 519 MB container.** The texture was already JPEG, not
PNG. The triangle count was modest. Nothing was obviously duplicated.

The other ~472 MB was buffer data that **no accessor pointed at** — dead weight
left behind by the export. One lossless command removed it:

```bash
gltf-transform dedup manhattan_heavy.glb stage1.glb
# 519.43 MB → 47.57 MB   (-90.8%)
```

**No pixels were touched. No vertices were removed. Nothing was approximated.**

The lesson generalises: the intuitive optimizations here — resize the texture,
simplify the mesh — would each have delivered single-digit percentages against
the real problem. Ninety percent of the win came from looking at the file first.
Had I started with the plan instead of the measurement, I would have spent the
effort in the wrong place and shipped a 470 MB asset.

---

## 2. The pipeline, stage by stage

Run as separate commands rather than one combined invocation, specifically so
each stage could be measured on its own.

| # | Stage | Bytes | MB | Triangles | Texture | GPU MB |
|---|---|---:|---:|---:|---|---:|
| — | source | 519,434,492 | 519.43 | 336,574 | 4096 JPEG | 122.77 |
| 1 | `dedup` | 47,574,108 | 47.57 | 336,574 | 4096 JPEG | 122.77 |
| 2 | `prune` | 47,574,108 | 47.57 | 336,574 | 4096 JPEG | 122.77 |
| 3 | `weld` | 45,548,200 | 45.55 | 336,574 | 4096 JPEG | 120.74 |
| 4 | `simplify` | — | — | **318,648** | — | — |
| 5 | texture → WebP | — | — | 318,648 | 4096 WebP 3.79 MB | — |
| 6 | `meshopt` | **11,045,848** | **11.05** | 318,648 | 4096 WebP | **89.48** |

`prune` removed nothing — `dedup` had already taken everything unreferenced. It
stays in the documented pipeline because a zero is a result: it proves there was
no second category of orphaned data.

### Why `simplify` barely did anything — and why that is correct

Requested `--ratio 0.5`, expecting to halve the triangles. It delivered **5.3%**
(336,574 → 318,648).

The `--error 0.01` bound is why. meshoptimizer stops collapsing edges once
deviation would exceed 1% of the model's size, and hard architectural surfaces —
flat walls meeting at sharp corners — have very little redundant geometry to
give up. The bound protected the building silhouettes, which is exactly its job.

I deliberately did **not** lower the ratio to force a bigger number. The size
target was already met three times over, so trading visible silhouette damage for
bytes nobody needed would have been a bad deal.

This also means the geometry you see is essentially the original's. That matters
when judging close-range quality: the blobby, melted building shapes are
photogrammetry reconstruction artifacts baked into the source scan, not damage
from this pipeline. Measured directly — upward-facing triangles are 18.7% of the
source and 18.6% of the shipped build, with roof surface area at 19.0% of the
total in **both**. The pipeline removes no roofs.

---

## 3. The honest version of "97.87% smaller"

The source **gzips to 25.32 MB**, because ~472 MB of duplicated bytes compress
away almost perfectly.

So the honest over-the-wire comparison is not 519 → 11. It is:

| | Source | Shipped |
|---|---:|---:|
| On disk | 519.43 MB | 11.05 MB |
| **Over the wire (compressed)** | **25.32 MB** | **11.05 MB** |

A "97.87% smaller" headline partly measures redundancy that any HTTP compression
layer would have caught for free. The durable wins are the ones gzip could *not*
have delivered:

- **GPU memory: 122.77 MB → 89.48 MB**, and 22.37 MB on the low tier
- **Triangles: 336,574 → 318,648**
- **Decode time: 918 ms → 255 ms** (Node, bytes preloaded, parse timed in isolation)

A curiosity worth knowing: **stage 1 gzips *larger* than the source** (26.37 vs
25.32 MB). `dedup` removed the redundancy gzip was exploiting, so the bytes that
remain are denser. Real effect, not a measurement error.

---

## 4. Compression codec: meshopt over Draco

Both were built and measured:

| Codec | Size | Decode |
|---|---:|---|
| **meshopt** (shipped) | 8.42 MB | fast, incremental |
| Draco | **2.89 MB** | slower, main-thread |

*(measured on the 2048 build, where geometry cost is isolated from the atlas)*

The brief anticipated Draco being "marginally smaller." **It is 65.6% smaller** —
not marginal at all.

Meshopt still ships. The 5.5 MB difference is under a second of extra download on
a normal connection, while Draco's decoder is heavier and runs on the main thread,
risking a stall on exactly the weak hardware the tier system exists to protect.
Measuring the alternative and rejecting it for a stated reason is part of the
result; had download size been the binding constraint rather than time-to-first-
frame, the decision would have gone the other way.

---

## 5. Texture: the KTX2 investigation, and why 4096 WebP shipped

Texel density is the atlas resolution spread across the model's actual surface
area, converted to **screen pixels per texel**. Above 1.0, the texture is being
magnified and reads soft.

| Atlas | texels/world-unit | @600u (wide) | @150u | @40u (street) |
|---|---:|---:|---:|---:|
| 1024 | 0.367 | 4.72 | 18.87 | 70.75 |
| 2048 | 0.733 | 2.36 | 9.43 | 35.37 |
| **4096** | **1.466** | **1.18** | 4.72 | 17.69 |

At 1024, even the default wide shot sits at 4.72 — soft before you zoom at all.
That killed 1024 immediately.

**KTX2/UASTC was then attempted**, because GPU-native block compression would keep
a 4096 atlas compressed in VRAM rather than decoded to raw RGBA. It did not work
out, for two measured reasons:

1. **4096 was unreachable.** KTX-Software is not installed and is not available
   through winget on this machine. The WASM encoder used instead
   (`ktx2-encoder`) enforces a 12,582,912 source-texel ceiling — a single
   4096×4096 image is 16,777,216 texels and exceeds it on its own. 3072 was the
   maximum it would encode.
2. **The trade was bad.** UASTC is high-entropy, so Zstd supercompression barely
   helps:

| Option | File | GPU | texels/unit |
|---|---:|---:|---:|
| 2048 WebP | 8.42 MB | 22.4 MB | 0.733 |
| 3072 KTX2 UASTC | **19.44 MB** | **12.6 MB** | 1.100 |
| **4096 WebP** (shipped) | 11.05 MB | 89.5 MB | **1.466** |

KTX2 wins decisively on GPU memory. But paying **19.44 MB for less texel density
than 4096 WebP delivers at 11.05 MB** is the wrong trade when quality is the goal
and the budget is 25 MB.

**The cost of shipping 4096 is honest and stated:** GPU texture memory goes back
up to 89.48 MB. That is mitigated by tiering — touch-primary and low-core devices
load the 2048 build at 22.37 MB instead.

### The limit no resolution fixes

This is **one shared atlas across an entire city**. At street level, even the
original 4096 source is magnified ~18×. Close-range softness is a property of the
source asset, not of this pipeline — which is why the resolution decision was made
from the density table rather than by eye.

---

## 6. Two upstream bugs worth documenting

### `gltf-transform resize` / `webp` fail outright

Both CLI commands, and the underlying `textureCompress()`, die with:

```
error: colourspace: parameter space not set
```

Two defects feed it. `remap(options.effort, …)` yields `NaN` when `effort` is not
supplied, and the JPEG branch forwards `chromaSubsampling: undefined` straight
into libvips. Supplying both explicitly still did not clear it.

Root cause underneath: the CLI routes texture I/O through `ndarray-pixels`, which
carries its own nested **sharp 0.35.3 missing the `@img/colour` native module**,
while the working top-level sharp is 0.34.5 with it present.

**Workaround:** skip that layer. `sharp` handles the texture perfectly on its own,
so the pipeline drives sharp directly and swaps the encoded bytes back into the
document. The glTF container is still managed by `@gltf-transform/core`, so
nothing about the file format is hand-rolled.

### Netlify does not compress the GLB

Confirmed twice — browser resource timing shows `transferSize == decodedBodySize`
(ratio 1.0), and `curl` with an explicit `Accept-Encoding: br, gzip` returns no
`Content-Encoding`. The JS bundle on the same origin **is** brotli-encoded, so
this is content-type specific: `application/octet-stream` is skipped.

Brotli would save **20.2%** (11.05 → 8.82 MB).

**Deliberately not taken.** Forcing it means storing brotli bytes under the `.glb`
filename and declaring `Content-Encoding: br`, which corrupts the download for any
client not sending `Accept-Encoding: br` and makes the committed file unopenable
as a GLB. 2.2 MB on an asset already reduced 98%, against a 25 MB budget, does not
justify a correctness cliff.

---

## 7. Runtime decisions

| Decision | Reason |
|---|---|
| `dpr` capped at 1.5 | Uncapped, a high-DPI screen draws 4–9× the pixels for no visible gain. Biggest free win available. |
| Shadows off | Real-time shadow maps across a city re-render the scene per light. The albedo already carries baked AO. |
| `near: 2`, `far: 2600` | Tight depth range avoids z-fighting. Possible only because the sky dome and ocean track the camera and can never fall outside it. |
| `stencil: false` | Unused buffer. |
| Anisotropic filtering, max | Mipmapping blurs surfaces seen at steep angles — roads, receding facades. The single biggest close-range quality win, and nearly free. |
| Roughness overridden to 0.62 | The asset ships `roughnessFactor: 1` with no roughness map: zero specular response, so a city of glass rendered as chalk. |
| Fog is `FogExp2` | Linear fog ramps evenly between two distances, so any setting that veiled the horizon also hazed the city. exp2 stays clear across the model and thickens beyond it. |
| Procedural sky + environment | drei's `Environment preset` fetches a 1K HDR from `raw.githack.com` — a third-party origin on the critical load path. Nothing here touches the network. |
| Post-processing latched one-way | Tying it to the live tier made the composer mount/unmount repeatedly, leaking render targets (texture count 6 → 110+) and collapsing 1% lows to 7 FPS. A one-way latch cannot oscillate. |

---

## 8. Deployed measurements

Cold cache, live Netlify site, Performance API.

| Metric | Value |
|---|---:|
| DOMContentLoaded | 3,247 ms |
| Load event | 3,248 ms |
| Model transfer | 11.05 MB in 3,123 ms |
| JS bundle | 1.55 MB → **482 KB** (brotli) |
| Total page weight | 11.53 MB |
| Draw calls | **17** |

`Cache-Control: public, max-age=31536000, immutable` verified live on `/models/*`
and `/assets/*` — the 11 MB is a first-visit cost only. `index.html` is
deliberately `must-revalidate`; it points at the hashed asset names, so caching it
would pin visitors to a stale build forever.

**17 draw calls for an entire city** — 14 building meshes, ocean, sky dome, and the
model's LINES primitive.

---

## 9. What this optimization did *not* achieve

Worth stating plainly, because the opposite claim would be easy to make and wrong.

The unoptimized 519 MB model, served from a local SSD with no network involved,
**still ran at 117 FPS**. The optimization did not rescue a broken frame rate. It
was never broken on this hardware.

The real wins are:

- **Delivery.** 519 MB is roughly 7 minutes at 10 Mbps, and effectively
  undeliverable on mobile. 11 MB is 3.1 seconds.
- **GPU memory.** 122.77 MB → 89.48 MB, or 22.37 MB on the low tier — which is
  what protects hardware weaker than the machine this was built on.

A frame-rate victory would be the easiest claim to make here, and it would not be
true.

---

## 10. What was not measured

Listed rather than estimated, because an invented figure is worth less than an
acknowledged gap:

- **Sustained FPS and 1% low on the deployed build.** Draw calls (17) are the
  renderer's own count and are reported above; frame rate over time is not.
- **Lighthouse Performance score.** Not run.
- **Firefox and Edge.** Verified in Chrome and on a physical Android device only.

Everything else in this document was measured directly.
