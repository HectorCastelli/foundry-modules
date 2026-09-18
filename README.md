# Zektor's FoundryVTT modules

A collection of modules for myself.

They facilitate my usage of Foundry VTT as a regular user, as a Map maker, and as a GM.

- One module exists for my base setup: `zektorh-common`;
- Another for my GM activities: `zektorh-gm`;
- Finally, modules for each game system exist with system-specific content: `zektorh-<system-id>`.

## Development workflow

This repository assumes you are running a local instance of foundry and making changes there.

To "retrieve" the changes and reflect them in this repository, run the `npm run unpack` command, which transforms all packs into raw JSON files.

## Publishing

Once the modules are ready to be published and shared, their contents need to be re-packed. This can be done with the `npm run build` command.
