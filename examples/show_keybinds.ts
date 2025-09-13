#!/usr/bin/env -S deno run

import { type Command, defaultCommands } from "@ud2/prompt";

const map = new Map<Command, string[]>();
(function dump(tree, prefix) {
  for (const [key, command] of Object.entries(tree)) {
    const sequence = prefix + key;
    if (typeof command === "function") {
      let sequences = map.get(command);
      if (!sequences) {
        map.set(command, sequences = []);
      }
      sequences.push(sequence);
    } else {
      dump(command, sequence);
    }
  }
})(defaultCommands, "");
for (
  const [command, keys] of Array.from(map)
    .sort(([{ name: a }], [{ name: b }]) => a > b ? 1 : a < b ? -1 : 0)
) {
  console.log("%s: %o", command.name, keys);
}
