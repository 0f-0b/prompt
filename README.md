# prompt

Line editing library.

## Example

```ts
import { prompt } from "jsr:@ud2/prompt";
import { DenoPromptEnvironment } from "jsr:@ud2/prompt/env/deno";

const env = new DenoPromptEnvironment();
const result = await prompt(env);
console.log(result);
```

See more in the `examples` directory.
