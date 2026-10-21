import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	commitScopes,
	parseCommit,
	validCommitScopes,
} from "./lib/conventional-commits.js";

const commitMessagePath = process.argv[2];
if (!commitMessagePath) {
	throw new Error("Pass the commit message file path as the first argument.");
}

const commitMessage = readFileSync(commitMessagePath, "utf8");
const commit = parseCommit(commitMessage);

if (!commit.type && !commit.revert) {
	throw new Error(
		`Invalid commit message header "${commit.header}". Use type(scope): subject.`,
	);
}

const modulesFolder = resolve(import.meta.dirname, "../modules");
if (commit.type && commit.scope) {
	const moduleIds = readdirSync(modulesFolder, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => {
			const manifest = JSON.parse(
				readFileSync(resolve(modulesFolder, entry.name, "module.json"), "utf8"),
			);
			return manifest.id;
		});
	const validScopes = validCommitScopes(moduleIds);
	const scopes = commitScopes(commit);
	const invalidScopes = scopes.filter((scope) => !validScopes.has(scope));
	if (invalidScopes.length > 0) {
		throw new Error(
			`Unknown commit scope${invalidScopes.length > 1 ? "s" : ""}: ${invalidScopes.join(", ")}. Valid scopes: ${[...validScopes].sort().join(", ")}.`,
		);
	}
}
