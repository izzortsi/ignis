// Scene contract and the input snapshot scenes read each frame.
//
// A scene draws to the Screen and returns a SceneCmd telling the loop what to
// do next: stay, replace itself, push/pop a stack, or quit. Keeping transitions
// in a returned command (not a callback) keeps the loop the single driver.

import type { Screen } from "./screen";

export interface Input {
  // Keys pressed since the last frame (debounced; one entry per physical press).
  pressed: Set<string>;
  // True on the frame the canvas size changed.
  resized: boolean;
}

export type SceneCmd =
  | { kind: "none" }
  | { kind: "replace"; next: Scene }
  | { kind: "push"; next: Scene }
  | { kind: "pop" }
  | { kind: "quit" };

export const Cmd = {
  none: { kind: "none" } as SceneCmd,
  replace: (next: Scene): SceneCmd => ({ kind: "replace", next }),
  push: (next: Scene): SceneCmd => ({ kind: "push", next }),
  pop: { kind: "pop" } as SceneCmd,
  quit: { kind: "quit" } as SceneCmd,
};

export interface Scene {
  // dt is seconds since the previous frame.
  update(dt: number, input: Input): SceneCmd;
  render(screen: Screen): void;
}
