import { createWriteStream, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import yazl from "yazl";

function addDirectory(zipFile, sourceDirectory, archiveDirectory = "") {
	for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
		const sourcePath = resolve(sourceDirectory, entry.name);
		const archivePath = archiveDirectory
			? `${archiveDirectory}/${entry.name}`
			: entry.name;

		if (entry.isDirectory()) {
			zipFile.addEmptyDirectory(archivePath);
			addDirectory(zipFile, sourcePath, archivePath);
		} else if (entry.isFile()) {
			zipFile.addFile(sourcePath, archivePath);
		} else if (entry.isSymbolicLink()) {
			const target = statSync(sourcePath);
			if (target.isDirectory()) {
				zipFile.addEmptyDirectory(archivePath);
				addDirectory(zipFile, sourcePath, archivePath);
			} else if (target.isFile()) {
				zipFile.addFile(sourcePath, archivePath);
			}
		}
	}
}

export async function zipFolder(sourceDirectory, archivePath) {
	const zipFile = new yazl.ZipFile();
	zipFile.on("error", (error) => zipFile.outputStream.destroy(error));
	const archiveOutput = pipeline(
		zipFile.outputStream,
		createWriteStream(archivePath),
	);

	try {
		addDirectory(zipFile, sourceDirectory);
		zipFile.end();
		await archiveOutput;
	} catch (error) {
		zipFile.outputStream.destroy();
		await archiveOutput.catch(() => {});
		throw error;
	}
}
