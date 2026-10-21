/**
 * Builds each module into `dist` for sharing
 */

console.log("Building modules...");

import { execFileSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

// Load .env for paths
import { configDotenv } from "dotenv";

configDotenv({
	quiet: true,
});

import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { getGitHubRepository } from "./lib/github-repository.js";

const { FOUNDRY_DATA_PATH } = process.env;

// Setup `dist` folder
const distFolder = resolve(import.meta.dirname, "../dist");
const repositoryFolder = resolve(import.meta.dirname, "..");
const modulesFolder = resolve(repositoryFolder, "modules");
const { url: repositoryUrl } = getGitHubRepository(repositoryFolder);

if (existsSync(distFolder)) {
	rmSync(distFolder, { recursive: true, force: true });
}
mkdirSync(distFolder, { recursive: true });
const latestManifestFolder = resolve(distFolder, "latest");
if (existsSync(latestManifestFolder)) {
	rmSync(latestManifestFolder, { recursive: true, force: true });
}
mkdirSync(latestManifestFolder, { recursive: true });

for (const module of readdirSync(modulesFolder)) {
	console.debug(`Re-packing ${module}`);

	for (const pack of readdirSync(resolve(modulesFolder, module, "packs"))) {
		console.debug(`Re-packing ${module}/${pack}`);

		try {
			await compilePack(
				`${FOUNDRY_DATA_PATH}/Data/modules/${module}/packs/${pack}/_source`,
				`${FOUNDRY_DATA_PATH}/Data/modules/${module}/packs/${pack}`,
				{
					yaml: true,
					recursive: true,
				},
			);
		} catch (error) {
			console.error(`Unable to re-pack ${module}/${pack}.`, error);
		}
	}

	console.debug(`Moving ${module} to ${distFolder}`);
	const moduleFolder = resolve(distFolder, module);
	mkdirSync(moduleFolder, { recursive: true });
	cpSync(resolve(modulesFolder, module), moduleFolder, {
		force: true,
		recursive: true,
		filter(source, _destination) {
			// Remove `packs/*/_source` from copy
			if (/packs\/.*\/_source/.test(source)) {
				return false;
			}
			return true;
		},
	});

	const manifestPath = resolve(moduleFolder, "module.json");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	if (manifest.id !== module) {
		throw new Error(
			`Module folder "${module}" does not match manifest id "${manifest.id}".`,
		);
	}
	if (
		typeof manifest.version !== "string" ||
		!manifest.version ||
		!/^[-+.\w]+$/.test(manifest.version)
	) {
		throw new Error(`Module "${module}" has an invalid version.`);
	}

	const tag = `${manifest.id}-v${manifest.version}`;
	manifest.url = repositoryUrl;
	manifest.manifest = `${repositoryUrl}/releases/latest/download/${manifest.id}-module.json`;
	manifest.download = `${repositoryUrl}/releases/download/${encodeURIComponent(tag)}/${manifest.id}.zip`;
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
	writeFileSync(
		resolve(latestManifestFolder, `${module}-module.json`),
		`${JSON.stringify(manifest, null, "\t")}\n`,
	);

	const archivePath = resolve(distFolder, `${manifest.id}.zip`);
	execFileSync("zip", ["-qr", archivePath, "."], {
		cwd: moduleFolder,
		stdio: "inherit",
	});
}
console.log("Done.");
