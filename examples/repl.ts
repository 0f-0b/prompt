#!/usr/bin/env -S deno run

import { prompt } from "jsr:@ud2/prompt";
import { DenoPromptEnvironment } from "jsr:@ud2/prompt/env/deno";

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
