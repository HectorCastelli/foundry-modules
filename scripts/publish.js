/**
 * Publishes the modules to GitHub releases and refreshes the "latest" release.
 */

console.log("Publishing modules...");

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Octokit } from "@octokit/rest";
import { getGitHubRepository } from "./lib/github-repository.js";

const distFolder = resolve(import.meta.dirname, "../dist");
const repositoryFolder = resolve(import.meta.dirname, "..");
const modulesFolder = resolve(repositoryFolder, "modules");
const { path: repositoryPath } = getGitHubRepository(repositoryFolder);
const [owner, repo] = repositoryPath.split("/");
if (!owner || !repo || repositoryPath.split("/").length !== 2) {
	throw new Error(`Invalid GitHub repository path "${repositoryPath}".`);
}

const token = execFileSync("gh", ["auth", "token"], {
	cwd: repositoryFolder,
	encoding: "utf8",
}).trim();
if (!token) {
	throw new Error("GitHub CLI did not return an authentication token.");
}

const octokit = new Octokit({ auth: token });
const existingRefs = await octokit.paginate(octokit.rest.git.listMatchingRefs, {
	owner,
	repo,
	ref: "tags/",
});
const existingTags = new Set(existingRefs.map((tag) => tag.ref));

async function createRelease(tag, title, makeLatest, assets) {
	const { data: release } = await octokit.rest.repos.createRelease({
		owner,
		repo,
		tag_name: tag,
		name: title,
		generate_release_notes: true,
		make_latest: makeLatest,
	});

	for (const { path, name, contentType } of assets) {
		const data = readFileSync(path);
		try {
			await octokit.rest.repos.uploadReleaseAsset({
				owner,
				repo,
				release_id: release.id,
				name,
				data,
				headers: {
					"content-type": contentType,
					"content-length": String(data.length),
				},
			});
		} catch (error) {
			throw new Error(`Unable to upload "${name}" to release "${tag}".`, {
				cause: error,
			});
		}
	}
}

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

	await createRelease(releaseTag, `${module} v${moduleVersion}`, "false", [
		{
			path: moduleZipPath,
			name: `${module}.zip`,
			contentType: "application/zip",
		},
		{
			path: moduleJsonPath,
			name: "module.json",
			contentType: "application/json",
		},
	]);
}

console.log("Publishing individual packages complete.");

console.log("Refreshing latest...");
const latestManifestFolder = resolve(distFolder, "latest");
const latestReleaseTag = "latest";
let latestRelease;

try {
	({ data: latestRelease } = await octokit.rest.repos.getReleaseByTag({
		owner,
		repo,
		tag: latestReleaseTag,
	}));
} catch (error) {
	if (error.status !== 404) throw error;
}

if (latestRelease) {
	await octokit.rest.repos.deleteRelease({
		owner,
		repo,
		release_id: latestRelease.id,
	});
}

if (existingTags.has(`refs/tags/${latestReleaseTag}`)) {
	await octokit.rest.git.deleteRef({
		owner,
		repo,
		ref: `tags/${latestReleaseTag}`,
	});
}

await createRelease(
	latestReleaseTag,
	"Latest",
	"true",
	readdirSync(latestManifestFolder).map((moduleFileName) => ({
		path: resolve(latestManifestFolder, moduleFileName),
		name: moduleFileName,
		contentType: "application/json",
	})),
);

console.log("Done.");
