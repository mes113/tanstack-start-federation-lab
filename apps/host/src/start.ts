import { createRemoteServerFunctions } from "@module-federation/tanstack/server-functions";
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";

const remoteFunctions = createRemoteServerFunctions({
  remotes: { catalog: { origin: "http://127.0.0.1:3004" } },
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: ({ handlerType }) => handlerType === "serverFn",
    }),
    createMiddleware().server(
      ({ next, request }) => remoteFunctions.handle(request) ?? next(),
    ),
  ],
}));
