/**
 * Publishes the modules to GitHub releases and refreshes the "latest" release.
 */

console.log("Publishing modules...");

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getGitHubRepository } from "./lib/github-repository.js";

const distFolder = resolve(import.meta.dirname, "../dist");
const repositoryFolder = resolve(import.meta.dirname, "..");
const modulesFolder = resolve(repositoryFolder, "modules");
const { path: repositoryPath } = getGitHubRepository(repositoryFolder);
const existingTags = new Set(
	JSON.parse(
		execFileSync(
			"gh",
			[
				"api",
				"--paginate",
				"--slurp",
				`repos/${repositoryPath}/git/matching-refs/tags/`,
			],
			{ cwd: repositoryFolder, encoding: "utf8" },
		),
	).flatMap((page) => page.map((tag) => tag.ref)),
);

for (const module of readdirSync(modulesFolder)) {
	console.debug(`Publishing ${module}`);

	const moduleZipPath = resolve(distFolder, `${module}.zip`);
	const moduleJsonPath = resolve(distFolder, module, "module.json");
	const moduleJson = JSON.parse(readFileSync(moduleJsonPath, "utf8"));
	const moduleVersion = moduleJson.version;

	const releaseTag = `${module}-v${moduleVersion}`;
	const releaseRef = `refs/tags/${releaseTag}`;

	const releaseExists = existingTags.has(releaseRef);
	if (releaseExists) {
		console.warn(`Tag ${releaseTag} already exists. Skipping.`);
		continue;
	}

	execFileSync(
		"gh",
		[
			"release",
			"create",
			releaseTag,
			`${moduleZipPath}#${module}.zip`,
			`${moduleJsonPath}#module.json`,
			"--title",
			`${module} v${moduleVersion}`,
			"--generate-notes",
			"--latest=false",
		],
		{ cwd: repositoryFolder, stdio: "inherit" },
	);
}

console.log("Publishing individual packages complete.");

console.log("Refreshing latest...");
const latestManifestFolder = resolve(distFolder, "latest");

try {
	execFileSync(
		"gh",
		["release", "delete", "latest", "--yes", "--cleanup-tag"],
		{ cwd: repositoryFolder, stdio: "inherit" },
	);
	execFileSync(
		"gh",
		[
			"api",
			"--method",
			"DELETE",
			`repos/${repositoryPath}/git/refs/tags/latest`,
		],
		{ cwd: repositoryFolder, stdio: "inherit" },
	);
} catch (_deleteError) {
	console.warn("No existing 'latest' release to delete.");
}

const latestAssets = [];
for (const module of readdirSync(latestManifestFolder)) {
	latestAssets.push(module);
}

execFileSync(
	"gh",
	[
		"release",
		"create",
		"latest",
		...latestAssets.map(
			(moduleFileName) =>
				`${resolve(latestManifestFolder, moduleFileName)}#${moduleFileName}`,
		),
		"--title",
		`Latest`,
		"--generate-notes",
		"--latest=true",
	],
	{ cwd: repositoryFolder, stdio: "inherit" },
);

console.log("Done.");
