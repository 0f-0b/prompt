#!/usr/bin/env -S deno run

import { type Command, defaultCommands } from "../mod.ts";

// deno-lint-ignore ban-types
const map: Partial<Record<Command, string[]>> = { __proto__: null } as {};
(function dump(tree, prefix) {
  for (const [key, command] of Object.entries(tree)) {
    const sequence = prefix + key;
    if (typeof command === "string") {
      map[command] ??= [];
      map[command].push(sequence);
    } else {
      dump(command, sequence);
    }
  }
})(defaultCommands, "");
for (
  const [command, keys] of Object.entries(map)
    .sort(([a], [b]) => a > b ? 1 : a < b ? -1 : 0)
) {
  console.log("%s: %o", command, keys);
}
