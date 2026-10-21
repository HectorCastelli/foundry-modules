# Zektor's FoundryVTT modules

A collection of modules for myself.

They facilitate my usage of Foundry VTT as a regular user, as a Map maker, and as a GM.

- One module exists for my base setup: `zektorh-global`;
- Another for my map-making activities: `zektorh-mapmaking`;
- Finally, modules for each game system exist with system-specific content: `zektorh-<system-id>`.

## Development workflow

This repository assumes you are running a local instance of foundry and making changes there. To set this up, create a `.env` file, then run `npm run link`.

From this point on, you can make changes to the packs inside foundry like you would normally.

To "retrieve" the changes and reflect them in this repository, stop the foundry instance, then run the `npm run unpack` command, which transforms all packs into raw JSON files.

## Publishing

Once the modules are ready to be published and shared, their contents need to be re-packed. This can be done with the `npm run build` command.

The outputs, ready to be published and shared, are moved to the `dist/` directory.

You can then run `npm run publish` to create one GitHub release per module version and upload its ZIP and `module.json`.

Each release is tagged `<module-id>-v<version>`. If a release with that version already exists, it won't be overwritten.
