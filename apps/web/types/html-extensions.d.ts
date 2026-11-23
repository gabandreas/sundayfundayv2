import "react";

declare module "react" {
  interface HTMLAttributes<T> {
    focusgroup?: string;
  }
}
