// Prépare les scans Poly Haven (CC0) de l'artefact pour le web.
// Sources : .design-src/polyhaven/ (boulder_01 ou rock_09, flower_gazania ; glTF 1k).
// Sortie : public/artefact/rock.glb et public/artefact/flower.glb
// Usage : node scripts/build-artefact.mjs   (ROCK=rock_09 pour l'autre roche)

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
	dedup,
	prune,
	weld,
	simplify,
	textureCompress,
	meshopt,
	center,
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = '.design-src/polyhaven';
const OUT = 'public/artefact';

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

const io = new NodeIO()
	.registerExtensions(ALL_EXTENSIONS)
	.registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

await mkdir(OUT, { recursive: true });

// La roche : maillage allégé si besoin, textures 1024 en WebP.
{
	const ROCK = process.env.ROCK ?? 'boulder_01';
	const doc = await io.read(`${SRC}/${ROCK}/${ROCK}_1k.gltf`);
	await doc.transform(
		weld(),
		simplify({ simplifier: MeshoptSimplifier, ratio: 0.35, error: 0.01 }),
		center({ pivot: 'center' }),
		textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
		dedup(),
		prune(),
		meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
	);
	await io.write(`${OUT}/rock.glb`, doc);
}

// La fleur : un seul plant du scan (le « g », le plus fourni en fleurs).
{
	const KEEP = process.env.PLANT ?? 'flower_gazania_g_LOD0';
	const doc = await io.read(`${SRC}/flower_gazania/flower_gazania_1k.gltf`);
	const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
	for (const node of doc.getRoot().listNodes()) {
		if (node.getName() !== KEEP) node.dispose();
	}
	const plant = doc.getRoot().listNodes()[0];
	plant.setTranslation([0, 0, 0]);
	scene.addChild(plant);
	await doc.transform(
		textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 85 }),
		dedup(),
		prune(),
		meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
	);
	await io.write(`${OUT}/flower.glb`, doc);
}

console.log('artefact prêt →', OUT);
