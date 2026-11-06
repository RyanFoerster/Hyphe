import type { APIRoute, GetStaticPaths } from 'astro';
import { projects } from '../../../data/projects';
import { projectSvg, VARIANT_COUNT } from '../../../lib/generative';

// Les déclinaisons de chaque projet : /visuals/<slug>/1.svg … /visuals/<slug>/6.svg
export const getStaticPaths = (() =>
	projects.flatMap((project) =>
		Array.from({ length: VARIANT_COUNT }, (_, i) => ({ params: { slug: project.slug, n: String(i + 1) }, props: { project, n: i + 1 } })),
	)) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
	new Response(projectSvg(props.project, props.n), {
		headers: { 'Content-Type': 'image/svg+xml' },
	});
