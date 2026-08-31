import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/battle/wallet")({
  beforeLoad: () => {
    throw redirect({ to: "/battle" });
  },
  component: WalletDisabledPage,
});

function WalletDisabledPage() {
  return null;
}
