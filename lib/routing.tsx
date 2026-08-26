"use client";

import type { ComponentProps } from "react";
import { Link as RouterLink, useNavigate, useParams as useReactRouterParams } from "react-router-dom";

type LinkProps = Omit<ComponentProps<typeof RouterLink>, "to"> & { href: string };

export function Link({ href, ...props }: LinkProps) {
  return <RouterLink to={href} {...props} />;
}

export function useRouter() {
  const navigate = useNavigate();
  return {
    replace: (path: string) => navigate(path, { replace: true }),
    push: (path: string) => navigate(path),
    back: () => navigate(-1),
  };
}

export function useParams<T extends Record<string, string | undefined>>() {
  return useReactRouterParams() as T;
}
