import { TilesRenderer, EnvironmentControls } from '3d-tiles-renderer';
import {
	GLTFExtensionsPlugin,
	UnloadTilesPlugin,
	DebugTilesPlugin,
} from '3d-tiles-renderer/plugins';
import {
	Scene,
	PerspectiveCamera,
	WebGPURenderer,
	Sphere,
	Color,
	ColorManagement,
	SRGBColorSpace,
} from 'three/webgpu';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFGaussianSplatLoaderExtension } from 'three/addons/loaders/GLTFGaussianSplatLoaderExtension.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';
import { UnifiedGaussianSplatsPlugin } from './plugins/UnifiedGaussianSplatsPlugin.js';
import { replacePivotMaterialWithNodeMaterial } from './plugins/pivotPointNodeMaterial.js';

// Splats are rendered from a glTF extension, so any tileset whose content uses
// "KHR_gaussian_splatting" works here. Point at one with the query parameter:
//
//   ?url=https://example.com/tileset.json
const DEFAULT_TILESET_URL = new URL( './data/gs_tileset_3/tileset.json', import.meta.url ).toString();
const TILESET_URL = new URLSearchParams( window.location.search ).get( 'url' ) ?? DEFAULT_TILESET_URL;

// the splat shading is authored against an sRGB working space
ColorManagement.workingColorSpace = SRGBColorSpace;

const options = {
	enabled: true,
	errorTarget: 20,
	displayBoxBounds: false,
};

let camera, controls, scene, renderer, tiles, stats;

init();

async function init() {

	// scene
	scene = new Scene();
	scene.background = new Color( 0x07080f );

	// camera
	camera = new PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 4000 );
	camera.position.set( 100, 100, 100 );

	// renderer. The splat mesh is built from node materials and compute based sorting, so it only
	// runs on the WebGPU renderer.
	renderer = new WebGPURenderer( { antialias: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );

	try {

		await renderer.init();

	} catch ( err ) {

		showMessage( 'This example requires a browser with WebGPU support.' );
		console.error( err );
		return;

	}

	// controls
	controls = new EnvironmentControls( scene, camera, renderer.domElement, null );
	controls.enableDamping = true;
	controls.adjustHeight = false;
	controls.minDistance = 0.01;
	controls.enableFlight = true;
	controls.flightSpeed = 1;
	controls.flightSpeedMultiplier = 2;

	// the pivot indicator ships with a raw glsl material, which WebGPU cannot compile
	replacePivotMaterialWithNodeMaterial( controls );

	initTiles();

	onWindowResize();
	window.addEventListener( 'resize', onWindowResize, false );

	// GUI
	const gui = new GUI();
	gui.close();
	gui.add( options, 'enabled' );
	gui.add( options, 'errorTarget', 0, 100, 1 ).onChange( v => {

		tiles.errorTarget = v;

	} );

	gui.add( options, 'displayBoxBounds' ).name( 'box bounds' ).onChange( v => {

		tiles.getPluginByName( 'DEBUG_TILES_PLUGIN' ).displayBoxBounds = v;

	} );

	stats = new Stats();
	document.body.appendChild( stats.dom );

	renderer.setAnimationLoop( animate );

}

function initTiles() {

	tiles = new TilesRenderer( TILESET_URL );
	tiles.loadAncestors = false;
	tiles.group.rotation.x = - Math.PI / 2;

	// registering the splat extension is all that is needed for splat content to load. The plugin
	// hands the callback to "GLTFLoader.register" for every tile that is parsed.
	tiles.registerPlugin( new GLTFExtensionsPlugin( {
		dracoLoader: new DRACOLoader(),
		plugins: [ parser => new GLTFGaussianSplatLoaderExtension( parser ) ],
	} ) );

	// Draws every visible tile's splats from a single mesh so they share one back to front sort,
	// which is what removes the seams between tiles.
	tiles.registerPlugin( new UnifiedGaussianSplatsPlugin() );

	// no fade plugin here: splats are alpha blended with depth writes disabled, so cross fading two
	// LODs of the same region draws both sets and makes the ordering errors between tiles worse
	tiles.registerPlugin( new UnloadTilesPlugin() );

	// the merged mesh hides which tile a splat came from, so the bounds show what the renderer
	// thinks is visible even when the splats for it are missing
	tiles.registerPlugin( new DebugTilesPlugin( {
		displayBoxBounds: options.displayBoxBounds,
	} ) );

	tiles.errorTarget = options.errorTarget;
	tiles.setCamera( camera );
	tiles.setResolutionFromRenderer( camera, renderer );

	// frame the camera on the tileset once its extents are known
	const frameTileSet = () => {

		const sphere = new Sphere();
		if ( ! tiles.getBoundingSphere( sphere ) ) {

			return;

		}

		tiles.removeEventListener( 'load-root-tileset', frameTileSet );

		// EnvironmentControls has no explicit target: it picks a pivot by raycasting the scene, so
		// the camera is simply placed and aimed at the content
		const radius = Math.max( sphere.radius, 0.01 );
		camera.position.copy( sphere.center ).addScalar( radius * 0.5 );
		camera.lookAt( sphere.center );
		camera.near = radius / 1000;
		camera.far = radius * 100;
		camera.updateProjectionMatrix();

	};

	tiles.addEventListener( 'load-root-tileset', frameTileSet );

	tiles.addEventListener( 'load-error', ( { error } ) => {

		showMessage( 'Failed to load the tileset. See the console for details.' );
		console.error( error );

	} );

	scene.add( tiles.group );

}

function showMessage( html ) {

	const el = document.getElementById( 'message' );
	el.innerHTML = html;
	el.style.display = 'block';

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	controls.update();
	camera.updateMatrixWorld();

	// freezing the update keeps the visible tile set exactly as it is, so the render cost can be
	// measured without streaming and lod changes moving it around
	if ( options.enabled ) {

		tiles.setResolutionFromRenderer( camera, renderer );
		tiles.setCamera( camera );
		tiles.update();

	}

	renderer.render( scene, camera );

	stats.update();

	document.getElementById( 'credits' ).innerText = tiles.getAttributions()[ 0 ]?.value || '';

}
