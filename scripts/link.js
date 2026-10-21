/**
 * Links this repository to a local installation of FoundryVTT.
 */

console.log("Linking repository to local foundry instance...");

import {
	existsSync,
	lstatSync,
	readdirSync,
	readlinkSync,
	rmSync,
	symlinkSync,
} from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(import.meta.dirname, "../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const { FOUNDRY_DATA_PATH } = process.env;

for (const module of readdirSync(resolve(import.meta.dirname, "../modules"))) {
	console.debug(`Linking ${module}`);

	const linkedDestination = resolve(
		FOUNDRY_DATA_PATH,
		"./Data/modules",
		module,
	);
	const linkedOrigin = resolve(import.meta.dirname, "../modules", module);

	let destinationStats;
	try {
		destinationStats = lstatSync(linkedDestination);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}

	if (destinationStats) {
		console.warn(`Destination ${linkedDestination} already exists.`);
		if (destinationStats.isSymbolicLink()) {
			if (readlinkSync(linkedDestination) === linkedOrigin) {
				console.warn(`It already is a symlink to the correct path. Skipping.`);
				continue;
			}
		} else {
			console.log(
				`This is not a symlink. The module must have been installed from a release.`,
			);
		}
		console.warn(`It will be replaced.`);
		rmSync(linkedDestination, { force: true, recursive: true });
	}
	symlinkSync(linkedOrigin, linkedDestination, "dir");
}

console.log("Done.");
