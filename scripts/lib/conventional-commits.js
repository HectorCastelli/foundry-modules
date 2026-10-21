import { CommitParser } from "conventional-commits-parser";

const parser = new CommitParser({
	headerPattern: /^([a-z][\w-]*)(?:\(([^()\r\n]+)\))?(!)?:\s.+$/,
	headerCorrespondence: ["type", "scope", "breaking", "subject"],
});

export function parseCommit(message) {
	return parser.parse(message);
}

export function commitScopes(commit) {
	return commit.scope?.split(",").map((scope) => scope.trim()) ?? [];
}

export function moduleScopes(moduleId) {
	return new Set([moduleId, moduleId.split("-").at(-1)]);
}

export function validCommitScopes(moduleIds) {
	const scopes = new Set(["core"]);
	for (const moduleId of moduleIds) {
		for (const scope of moduleScopes(moduleId)) scopes.add(scope);
	}
	return scopes;
}
