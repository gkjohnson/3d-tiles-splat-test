import { GaussianSplatGroup } from 'three/addons/objects/GaussianSplatGroup.js';

/**
 * Renders every visible splat tile through a single `GaussianSplatGroup`.
 *
 * Splats are alpha blended without depth writes, so they only composite correctly when drawn
 * back to front. Independent `GaussianSplat` tiles each sort themselves, which leaves the
 * ordering between tiles to the renderer's per object sort and shows seams at tile boundaries.
 * The group merges the visible tiles into one buffer and sorts every splat together, which
 * removes them.
 *
 * The merging, sorting, and rendering are all handled by `GaussianSplatGroup` - this plugin
 * only maps tile content and visibility onto the group's splat instances.
 */
export class UnifiedGaussianSplatsPlugin {

	constructor( options = {} ) {

		const { binCount, workgroupSize } = options;

		this.name = 'UNIFIED_GAUSSIAN_SPLATS_PLUGIN';
		this.priority = 0;
		this.tiles = null;

		this.group = null;
		this._groupOptions = { binCount, workgroupSize };

		// tile -> array of group splat ids
		this._tileIds = new Map();

	}

	init( tiles ) {

		this.tiles = tiles;

		this.group = new GaussianSplatGroup( this._groupOptions );
		tiles.group.add( this.group );

	}

	// registers the tile's splats with the group, transformed into the tile set frame. The
	// original splat objects are hidden since the group draws them instead.
	processTileModel( scene, tile ) {

		const splats = [];
		scene.traverse( c => {

			if ( c.isGaussianSplat ) {

				splats.push( c );

			}

		} );

		// this runs before the scene is added to the group, and the tile transform has already
		// been baked into "scene.matrix", so the world matrices below are the tile set local ones
		scene.updateMatrixWorld( true );

		const visible = this.tiles.visibleTiles.has( tile );
		const ids = [];
		for ( let i = 0, l = splats.length; i < l; i ++ ) {

			const splat = splats[ i ];
			const id = this.group.addSplat( splat.splatGeometry );
			this.group.setMatrixAt( id, splat.matrixWorld );
			this.group.setVisibleAt( id, visible );

			// the group draws these splats instead
			splat.visible = false;

			ids.push( id );

		}

		this._tileIds.set( tile, ids );

	}

	setTileVisible( tile, visible ) {

		const ids = this._tileIds.get( tile ) ?? [];
		for ( let i = 0, l = ids.length; i < l; i ++ ) {

			this.group.setVisibleAt( ids[ i ], visible );

		}

		// fall through to the renderer's own visibility handling
		return false;

	}

	disposeTile( tile ) {

		const ids = this._tileIds.get( tile ) ?? [];
		for ( let i = 0, l = ids.length; i < l; i ++ ) {

			this.group.deleteSplat( ids[ i ] );

		}

		this._tileIds.delete( tile );

	}

	dispose() {

		this.group.removeFromParent();
		this.group.dispose();
		this.group = null;

		this._tileIds.clear();

	}

}
