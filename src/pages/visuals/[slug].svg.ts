import type { APIRoute, GetStaticPaths } from 'astro';
import { projects } from '../../data/projects';
import { projectSvg } from '../../lib/generative';

export const getStaticPaths = (() =>
	projects.map((project) => ({ params: { slug: project.slug }, props: { project } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
	new Response(projectSvg(props.project), {
		headers: { 'Content-Type': 'image/svg+xml' },
	});
