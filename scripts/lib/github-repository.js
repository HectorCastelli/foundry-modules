import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function getGitHubRepository(repositoryFolder) {
	const packageJson = JSON.parse(
		readFileSync(resolve(repositoryFolder, "package.json"), "utf8"),
	);
	const repositoryUrl = packageJson.repository?.url?.replace(/^git\+/, "");

	let url;
	try {
		url = new URL(repositoryUrl);
	} catch {
		throw new Error("package.json must specify a GitHub repository URL.");
	}

	const repositoryPath = url.pathname
		.replace(/\/+$/, "")
		.replace(/\.git$/, "")
		.replace(/^\/+/, "");
	if (
		url.protocol !== "https:" ||
		url.hostname !== "github.com" ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		!repositoryPath
	) {
		throw new Error("package.json must specify a GitHub repository URL.");
	}

	return {
		url: `${url.origin}/${repositoryPath}`,
		path: repositoryPath,
	};
}
