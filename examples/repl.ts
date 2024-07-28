#!/usr/bin/env -S deno run

import { DenoPromptEnvironment } from "../env/deno.ts";
import { prompt } from "../mod.ts";

const history: string[] = [];
const env = new DenoPromptEnvironment();
for (;;) {
  const result = await prompt(env, { history });
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
