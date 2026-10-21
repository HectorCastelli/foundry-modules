/**
 * Publishes each built module as a separate GitHub release.
 */

console.log("Publishing modules...");

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryFolder = resolve(import.meta.dirname, "..");
const modulesFolder = resolve(repositoryFolder, "modules");
const distFolder = resolve(repositoryFolder, "dist");
const packageJson = JSON.parse(
	readFileSync(resolve(repositoryFolder, "package.json"), "utf8"),
);
const repositoryUrl = packageJson.repository?.url
	?.replace(/^git\+/, "")
	.replace(/\.git$/, "");

if (!repositoryUrl?.startsWith("https://github.com/")) {
	throw new Error("package.json must specify a GitHub repository URL.");
}

const repositoryPath = new URL(repositoryUrl).pathname.replace(/^\/|\/$/g, "");
if (!/^[^/]+\/[^/]+$/.test(repositoryPath)) {
	throw new Error("package.json must specify a GitHub owner and repository.");
}

const modules = [];
for (const directory of readdirSync(modulesFolder, { withFileTypes: true })) {
	if (!directory.isDirectory()) continue;

	const moduleFolder = resolve(distFolder, directory.name);
	const manifestPath = resolve(moduleFolder, "module.json");
	const archivePath = resolve(distFolder, `${directory.name}.zip`);
	if (!existsSync(manifestPath)) {
		throw new Error(
			`Missing built module manifest: ${manifestPath}. Run "npm run build" first.`,
		);
	}
	if (!existsSync(archivePath)) {
		throw new Error(
			`Missing built module archive: ${archivePath}. Run "npm run build" first.`,
		);
	}

	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	if (manifest.id !== directory.name) {
		throw new Error(
			`Module folder "${directory.name}" does not match manifest id "${manifest.id}".`,
		);
	}
	if (
		typeof manifest.version !== "string" ||
		!manifest.version ||
		!/^[-+.\w]+$/.test(manifest.version)
	) {
		throw new Error(
			`Module "${directory.name}" has an invalid version: ${manifest.version}`,
		);
	}

	const tag = `${manifest.id}-v${manifest.version}`;
	const releaseUrl = `${repositoryUrl}/releases/download/${encodeURIComponent(tag)}`;
	if (
		manifest.url !== repositoryUrl ||
		manifest.manifest !== `${releaseUrl}/module.json` ||
		manifest.download !== `${releaseUrl}/${manifest.id}.zip`
	) {
		throw new Error(
			`Built manifest for "${manifest.id}" has incorrect release URLs. Run "npm run build" first.`,
		);
	}

	modules.push({
		id: manifest.id,
		version: manifest.version,
		tag,
		assets: [archivePath, manifestPath],
	});
}

if (modules.length === 0) {
	throw new Error(`No module directories found in ${modulesFolder}.`);
}

const existingTags = execFileSync(
	"gh",
	[
		"api",
		"--paginate",
		"--jq",
		".[].tag_name",
		`repos/${repositoryPath}/releases`,
	],
	{
		cwd: repositoryFolder,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	},
)
	.split("\n")
	.filter(Boolean);

const existingModules = modules.filter((module) =>
	existingTags.includes(module.tag),
);
if (existingModules.length > 0) {
	console.warn("Publishing stopped; these module releases already exist:");
	for (const module of existingModules) {
		console.warn(`- ${module.id} ${module.version} (${module.tag})`);
	}
	process.exit(1);
}

for (const module of modules) {
	console.debug(
		`Publishing ${module.id} ${module.version} (ZIP and module.json)`,
	);

	execFileSync(
		"gh",
		[
			"release",
			"create",
			module.tag,
			...module.assets,
			"--title",
			`${module.id} ${module.version}`,
			"--notes",
			`Release ${module.id} version ${module.version}.`,
			"--latest=false",
		],
		{
			cwd: repositoryFolder,
			stdio: "inherit",
		},
	);
}

console.log("Done.");
