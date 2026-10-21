/**
 * Updates module versions based on conventional commits since each module's latest tag.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import semver from "semver";
import {
	commitScopes,
	moduleScopes,
	parseCommit,
} from "./lib/conventional-commits.js";

const repositoryFolder = resolve(import.meta.dirname, "..");
const modulesFolder = resolve(repositoryFolder, "modules");

function runGit(args) {
	return execFileSync("git", args, {
		cwd: repositoryFolder,
		encoding: "utf8",
	});
}

function parseVersion(version, source) {
	const parsed = semver.parse(version);
	if (
		!parsed ||
		parsed.version !== version ||
		parsed.prerelease.length > 0 ||
		parsed.build.length > 0
	) {
		throw new Error(`Invalid semantic version "${version}" in ${source}.`);
	}
	return version;
}

function bumpVersion(version, bump) {
	const nextVersion = semver.inc(parseVersion(version, "module version"), bump);
	if (!nextVersion) {
		throw new Error(`Unable to increment semantic version "${version}".`);
	}
	return nextVersion;
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
		.sort((left, right) => semver.rcompare(left.version, right.version));

	if (tags.length === 0) {
		throw new Error(`No local version tag found for module "${moduleId}".`);
	}
	return tags[0];
}

function commitBump(commit) {
	if (!commit.scope) return null;
	const isBreaking = Boolean(commit.breaking) || commit.notes.length > 0;
	if (isBreaking) return "major";
	if (commit.type === "feat") return "minor";
	if (commit.type === "fix") return "patch";
	return null;
}

function highestBump(current, next) {
	const rank = { patch: 1, minor: 2, major: 3 };
	return !current || rank[next] > rank[current] ? next : current;
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
		const parsedCommit = parseCommit(`${subject}\n\n${body}`);
		if (!commitScopes(parsedCommit).some((scope) => scopes.has(scope))) {
			continue;
		}

		const commitChange = commitBump(parsedCommit);
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
	const finalVersion = semver.gt(
		currentVersion,
		parseVersion(nextVersion, "calculated version"),
	)
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
