#!/usr/bin/env -S deno run

import { prompt } from "@ud2/prompt/deno";

const history: string[] = [];
for (;;) {
  const result = await prompt({ history });
  console.log(result);
  if (result.action === "cancel") {
    break;
  }
  if (result.action === "abort") {
    continue;
  }
  if (result.text) {
    history.push(result.text);
  }
}
