/**
 * Updates module versions based on conventional commits since each module's latest tag.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryFolder = resolve(import.meta.dirname, "..");
const modulesFolder = resolve(repositoryFolder, "modules");

function runGit(args) {
	return execFileSync("git", args, {
		cwd: repositoryFolder,
		encoding: "utf8",
	});
}

function parseVersion(version, source) {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
	if (!match) {
		throw new Error(`Invalid semantic version "${version}" in ${source}.`);
	}
	return match.slice(1).map(Number);
}

function compareVersions(left, right) {
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) {
			return left[index] - right[index];
		}
	}
	return 0;
}

function bumpVersion(version, bump) {
	const [major, minor, patch] = parseVersion(version, "module version");
	if (bump === "major") return `${major + 1}.0.0`;
	if (bump === "minor") return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
}

function latestModuleTag(moduleId) {
	const prefix = `${moduleId}-v`;
	const tags = runGit(["tag", "--list"])
		.split("\n")
		.filter((tag) => tag.startsWith(prefix))
		.map((tag) => {
			const version = tag.slice(prefix.length);
			return { tag, version: parseVersion(version, `tag "${tag}"`) };
		})
		.sort((left, right) => compareVersions(right.version, left.version));

	if (tags.length === 0) {
		throw new Error(`No local version tag found for module "${moduleId}".`);
	}
	return tags[0];
}

function commitBump(subject, body) {
	const match = /^([a-z][\w-]*)(?:\(([^()\r\n]+)\))?(!)?:\s.+$/.exec(subject);
	if (!match?.[2]) return null;

	const isBreaking =
		Boolean(match[3]) || /^BREAKING CHANGE:|^BREAKING-CHANGE:/m.test(body);
	if (isBreaking) return "major";
	if (match[1] === "feat") return "minor";
	if (match[1] === "fix") return "patch";
	return null;
}

function highestBump(current, next) {
	const rank = { patch: 1, minor: 2, major: 3 };
	return !current || rank[next] > rank[current] ? next : current;
}

function moduleScopes(moduleId) {
	const parts = moduleId.split("-");
	return new Set([moduleId, parts.at(-1)]);
}

const modules = readdirSync(modulesFolder, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => {
		const manifestPath = resolve(modulesFolder, entry.name, "module.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
		if (manifest.id !== entry.name) {
			throw new Error(
				`Module folder "${entry.name}" does not match manifest id "${manifest.id}".`,
			);
		}
		return { id: manifest.id, manifest, manifestPath };
	});

const changes = [];
for (const module of modules) {
	const lastTag = latestModuleTag(module.id);
	const commits = runGit([
		"log",
		`--format=%s%x1f%b%x1e`,
		`${lastTag.tag}..HEAD`,
	])
		.split("\x1e")
		.map((commit) => commit.replace(/^\r?\n/, ""))
		.filter(Boolean);
	let bump = null;
	const scopes = moduleScopes(module.id);

	for (const commit of commits) {
		const [subject, body = ""] = commit.split("\x1f");
		const commitScope = /^\w[\w-]*\(([^()\r\n]+)\)/.exec(subject)?.[1];
		if (
			!commitScope
				?.split(",")
				.map((scope) => scope.trim())
				.some((scope) => scopes.has(scope))
		) {
			continue;
		}

		const commitChange = commitBump(subject, body);
		if (commitChange) bump = highestBump(bump, commitChange);
	}

	if (!bump) {
		console.log(`${module.id}: no version change since ${lastTag.tag}`);
		continue;
	}

	const nextVersion = bumpVersion(
		lastTag.tag.slice(`${module.id}-v`.length),
		bump,
	);
	const currentVersion = parseVersion(
		module.manifest.version,
		`${module.id}/module.json`,
	);
	const finalVersion =
		compareVersions(
			currentVersion,
			parseVersion(nextVersion, "calculated version"),
		) > 0
			? module.manifest.version
			: nextVersion;

	if (finalVersion === module.manifest.version) {
		console.log(`${module.id}: already at ${finalVersion}`);
		continue;
	}

	changes.push({ ...module, version: finalVersion });
	console.log(
		`${module.id}: ${module.manifest.version} -> ${finalVersion} (${bump})`,
	);
}

for (const change of changes) {
	change.manifest.version = change.version;
	writeFileSync(
		change.manifestPath,
		`${JSON.stringify(change.manifest, null, "\t")}\n`,
	);
}
