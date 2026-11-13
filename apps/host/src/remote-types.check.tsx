import ServerPanel from "catalog/ServerPanel";
import type { ComponentProps } from "react";
type RemoteProps = ComponentProps<typeof ServerPanel>;
type Preloaded = Awaited<ReturnType<typeof ServerPanel.preload>>;
type IsAny<T> = 0 extends 1 & T ? true : false;
type Assert<T extends true> = T;
export type TypedRemoteProps = Assert<
  IsAny<RemoteProps> extends false ? true : false
>;
export type TypedRemoteResult = Assert<
  IsAny<Preloaded> extends false ? true : false
>;
export const valid = <ServerPanel title="Generated types" initialData={null} />;
// @ts-expect-error Generated declaration requires a string title.
export const wrongType = <ServerPanel title={123} initialData={null} />;
export const unknownProp = (
  // @ts-expect-error Unknown props must be rejected by the remote declaration.
  <ServerPanel title="Check" initialData={null} unknown />
);
// @ts-expect-error SSR data is a required prop.
export const missingData = <ServerPanel title="Check" />;
// @ts-expect-error The component loader has no arbitrary arguments.
export const wrongLoaderInput = () => ServerPanel.preload({ arbitrary: true });

export function validateRemoteContract(data: Preloaded) {
  const exactBackend: "catalog" = data.server.app;
  const price: number | undefined = data.rows[0]?.price;
  const status: "Active" | "Draft" | "Archived" | undefined =
    data.rows[0]?.status;
  const props: RemoteProps = { title: "Products", initialData: data };
  // @ts-expect-error Remote DTO prices are numbers.
  const invalidPrice: string = data.rows[0]!.price;
  // @ts-expect-error Unknown DTO fields must not turn into any.
  data.rows[0]!.doesNotExist;
  return { exactBackend, price, status, props, invalidPrice };
}
