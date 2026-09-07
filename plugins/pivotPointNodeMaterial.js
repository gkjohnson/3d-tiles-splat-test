import { MeshBasicNodeMaterial, Vector2 } from 'three/webgpu';
import {
	Fn,
	abs,
	cameraProjectionMatrix,
	float,
	fwidth,
	length,
	modelViewMatrix,
	positionLocal,
	smoothstep,
	uniform,
	uv,
	vec2,
	vec4,
} from 'three/tsl';

/**
 * Replaces the material on an `EnvironmentControls` pivot indicator with a node material.
 *
 * The stock indicator is a raw glsl `ShaderMaterial`, which `WebGPURenderer` cannot compile, so the
 * ring is rebuilt in TSL. It draws the same thing: a degenerate plane expanded to a fixed pixel
 * size around the pivot, with a circular outline drawn into it.
 *
 * @param {EnvironmentControls} controls - The controls whose pivot indicator is replaced.
 * @param {Object} [options]
 * @param {number} [options.size=15] - Radius of the ring in pixels.
 * @param {number} [options.thickness=2] - Thickness of the ring in pixels.
 */
export function replacePivotMaterialWithNodeMaterial( controls, options = {} ) {

	const { size = 15, thickness = 2 } = options;

	const sizeUniform = uniform( size );
	const thicknessUniform = uniform( thickness );

	// the ring is sized in css pixels, so this tracks "getSize" rather than the drawing buffer size
	// that "screenSize" reports
	const resolutionUniform = uniform( new Vector2() );

	const material = new MeshBasicNodeMaterial();
	material.transparent = true;
	material.depthTest = false;
	material.depthWrite = false;

	// the plane has no extent of its own, so the corners are pushed out to a fixed pixel size around
	// the projected pivot. The offset is scaled by "w" so it survives the perspective divide.
	material.vertexNode = Fn( () => {

		const aspect = resolutionUniform.x.div( resolutionUniform.y );
		const offset = uv().mul( 2 ).sub( vec2( 1 ) ).toVar( 'offset' );
		offset.y.assign( offset.y.mul( aspect ) );

		const clip = cameraProjectionMatrix
			.mul( modelViewMatrix )
			.mul( vec4( positionLocal, 1 ) )
			.toVar( 'clip' );

		const scale = sizeUniform.add( thicknessUniform ).mul( clip.w ).div( resolutionUniform.x );
		clip.xy.assign( clip.xy.add( offset.mul( scale ) ) );

		return clip;

	} )();

	// the ring is the set of texels a fixed distance from the middle, feathered by a pixel so it
	// stays smooth at any size
	material.colorNode = Fn( () => {

		const halfThickness = thicknessUniform.mul( 0.5 );
		const planeDim = sizeUniform.add( thicknessUniform );
		const radius = planeDim.sub( halfThickness ).sub( 2 ).div( planeDim );
		const texelThickness = halfThickness.div( planeDim );

		const distance = abs( length( uv().mul( 2 ).sub( vec2( 1 ) ) ).sub( radius ) ).toVar( 'distance' );
		const feather = fwidth( distance ).mul( 0.5 );
		const alpha = smoothstep( texelThickness.sub( feather ), texelThickness.add( feather ), distance );

		return vec4( 1, 1, 1, float( 1 ).sub( alpha ) );

	} )();

	const { pivotMesh } = controls;
	pivotMesh.material.dispose();
	pivotMesh.material = material;

	// the stock mesh writes the viewport size into the uniforms of the material it replaces
	pivotMesh.onBeforeRender = renderer => {

		renderer.getSize( resolutionUniform.value );

	};

	return material;

}
