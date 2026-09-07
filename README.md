# 3d-tiles-splat-test

Standalone test page for rendering Gaussian splat 3D Tiles with
[3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS) and three.js'
`GaussianSplatGroup` from [mrdoob/three.js#34290](https://github.com/mrdoob/three.js/pull/34290).
Requires a browser with WebGPU support.

No build step - three.js and 3d-tiles-renderer are loaded from a CDN via import maps, with
three.js pinned to the PR head commit. Serve the folder statically and open the page:

```
npx http-server .
```

A sample splat tileset is included under `./data` and loaded by default. Load another tileset
with the query parameter:

```
?url=https://example.com/tileset.json
```
