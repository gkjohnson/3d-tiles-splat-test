# 3d-tiles-splat-test

Test page for rendering Gaussian splat 3D Tiles with
[3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS) and three.js'
`GaussianSplatGroup` from [mrdoob/three.js#34290](https://github.com/mrdoob/three.js/pull/34290).
Requires a browser with WebGPU support.

Run:

```
npx servez
```

A sample splat tileset is loaded by default. Load another with the query parameter:

```
?url=https://example.com/tileset.json
```
